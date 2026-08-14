import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'

type Row = Record<string, any>

// Review workflow states for a project's draft:
//  draft       -> being prepared / with L3 (not yet submitted)
//  pending_l2  -> L3 submitted, awaiting Manager L2 review
//  rejected_l3 -> L2 rejected, back to L3 to correct & resubmit
//  pending_l1  -> L2 approved, awaiting Manager L1 review
//  rejected_l2 -> L1 rejected, back to L2 to correct & resubmit
//  locked      -> L1 locked (final, uneditable; visible to the bank once paid)
@Injectable()
export class ManagerDraftsService implements OnModuleInit {
  private readonly logger = new Logger(ManagerDraftsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.query(`CREATE TABLE IF NOT EXISTS drafts (
        id SERIAL PRIMARY KEY, project_id VARCHAR(20) NOT NULL UNIQUE,
        data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'draft'`)
      // Widen for longer statuses like 'rejected_to_coordinator' (23 chars).
      await this.db.query(`ALTER TABLE drafts ALTER COLUMN review_status TYPE VARCHAR(40)`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS reject_reason TEXT NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false`)
    } catch (err) {
      this.logger.error(`Manager drafts setup failed: ${(err as Error).message}`)
    }
  }

  // All projects (with valuations + review status). `view` splits the lists:
  //  'check'       — drafts newly arrived at this level to review (pending_lX)
  //  'corrections' — drafts sent BACK to this level to fix (rejected_lX)
  //  'final'       — locked reports (L1 only)
  //  'approved'    — drafts this level has approved and passed further up (L2/L3)
  //  'rejected'    — drafts this level has rejected further down (L2/L3)
  async projects(level: string, view: 'check' | 'corrections' | 'final' | 'approved' | 'rejected' = 'check') {
    const r = await this.db.query(
      `SELECT v.project_id, v.valuation_id, v.status, v.technical_officer_id,
              p.owner_name_as_per_deed, p.village_town, p.district,
              u.first_name, u.last_name,
              COALESCE(d.review_status, 'draft') AS review_status, COALESCE(d.reject_reason,'') AS reject_reason
         FROM valuations v
         JOIN projects p ON p.project_id = v.project_id
         LEFT JOIN users u ON u.user_id = p.applicant_nic
         LEFT JOIN drafts d ON d.project_id = v.project_id
        ORDER BY d.created_at DESC NULLS LAST, v.project_id DESC, v.valuation_id`,
    )

    const map = new Map<string, Row>()
    for (const x of r.rows as Row[]) {
      if (!map.has(x.project_id)) {
        const owner = `${x.first_name ?? ''} ${x.last_name ?? ''}`.trim() || x.owner_name_as_per_deed || '—'
        map.set(x.project_id, {
          projectId: x.project_id,
          ownerName: owner,
          location: [x.village_town, x.district].filter(Boolean).join(', '),
          reviewStatus: x.review_status,
          rejectReason: x.reject_reason,
          valuations: [],
        })
      }
      map.get(x.project_id)!.valuations.push({
        valuationId: Number(x.valuation_id),
        status: x.status,
        technicalOfficerId: x.technical_officer_id ?? '',
      })
    }
    // "Check Drafts" = new arrivals to review; "Corrections" = sent back to fix;
    // "Final" = locked reports (L1 only); "Approved" = this level's drafts that
    // have since moved further up the chain (or, for L1, been locked); "Rejected"
    // = drafts this level sent back down the chain.
    const CHECK: Record<string, string> = { L3: 'pending_l3', L2: 'pending_l2', L1: 'pending_l1' }
    const CORRECTIONS: Record<string, string> = { L3: 'rejected_l3', L2: 'rejected_l2' }
    const APPROVED: Record<string, string[]> = {
      L3: ['pending_l2', 'rejected_l2', 'pending_l1', 'locked'],
      L2: ['pending_l1', 'locked'],
      L1: ['locked'],
    }
    // L1 rejects down to L2 (rejected_l2); L2 rejects down to L3 (rejected_l3);
    // L3 rejects down to the Technical Officer (rejected_to_to).
    const REJECTED: Record<string, string> = { L1: 'rejected_l2', L2: 'rejected_l3', L3: 'rejected_to_to' }
    let list = Array.from(map.values())
    if (view === 'approved') {
      const want = APPROVED[level] ?? []
      list = want.length ? list.filter((p) => want.includes(p.reviewStatus)) : []
    } else if (view === 'rejected') {
      const want = REJECTED[level] ?? ''
      list = want ? list.filter((p) => p.reviewStatus === want) : []
    } else {
      const want = view === 'final' ? 'locked' : view === 'corrections' ? CORRECTIONS[level] ?? '' : CHECK[level] ?? ''
      list = want ? list.filter((p) => p.reviewStatus === want) : []
    }
    return list
  }

  // Save the (edited) report + move the draft to a new review status.
  async fields(projectId: string) {
    const p = projectId.trim()
    const result = await this.db.query(
      `SELECT d.data AS draft_data, i.data AS inspection_data, la.data AS analysis_data
         FROM projects p
         LEFT JOIN drafts d ON d.project_id = p.project_id
         LEFT JOIN inspections i ON i.project_id = p.project_id
         LEFT JOIN land_analyses la ON la.project_id = p.project_id
        WHERE p.project_id = $1`,
      [p],
    )
    const row = result.rows[0] ?? {}
    return {
      inspectionDate: String(row.inspection_data?.inspectionDate ?? ''),
      valuationDate: String(row.draft_data?.valuationDate ?? row.analysis_data?.summary?.valuationDate ?? ''),
    }
  }

  async action(projectId: string, reportHtml: string | undefined, status: string, reason = '', valuationDate?: string) {
    const p = (projectId ?? '').trim()
    if (!p || !status) return { ok: false, error: 'Missing project or status.' }
    if (reportHtml != null) {
      await this.db.query(
        `INSERT INTO drafts (project_id, data, review_status, reject_reason)
         VALUES ($1, jsonb_build_object('reportHtml', $2::text, 'valuationDate', $5::text), $3, $4)
         ON CONFLICT (project_id) DO UPDATE SET
           data = COALESCE(drafts.data, '{}'::jsonb) || jsonb_build_object('reportHtml', $2::text, 'valuationDate', $5::text),
           review_status = $3, reject_reason = $4, created_at = now()`,
        [p, reportHtml, status, reason, valuationDate ?? ''],
      )
    } else {
      await this.db.query(
        `INSERT INTO drafts (project_id, review_status, reject_reason) VALUES ($1, $2, $3)
         ON CONFLICT (project_id) DO UPDATE SET review_status = $2, reject_reason = $3, created_at = now()`,
        [p, status, reason],
      )
    }
    await this.notifyAction(p, status)
    return { ok: true }
  }

  // Notify the loan applicant and (if resolvable) the requesting bank of a
  // review milestone on their project. Separate wording for each, since a
  // bank isn't "your" project. Never throws.
  private async notifyStakeholders(projectId: string, applicantMsg: string, bankMsg: string) {
    try {
      const proj = (await this.db.query(`SELECT applicant_nic, bank_email FROM projects WHERE project_id = $1`, [projectId]))
        .rows[0] as { applicant_nic?: string; bank_email?: string } | undefined
      if (proj?.applicant_nic) await this.notifications.create(proj.applicant_nic, applicantMsg)
      const bankEmail = proj?.bank_email ?? ''
      if (bankEmail) {
        const bankUserId = await this.notifications.resolveBankUserId(bankEmail)
        if (bankUserId) await this.notifications.create(bankUserId, bankMsg)
      }
    } catch (err) {
      this.logger.error(`Stakeholder notification failed: ${(err as Error).message}`)
    }
  }

  // Notify the right people whenever a draft moves through the review chain.
  private async notifyAction(projectId: string, status: string) {
    try {
      const notifyRole = async (role: string, msg: string) => {
        const r = await this.db.query(`SELECT user_id FROM users WHERE role = $1`, [role])
        for (const u of r.rows as Row[]) await this.notifications.create(u.user_id as string, msg)
      }
      if (status === 'pending_l2') {
        await notifyRole('Manager L2', `Project ${projectId} has been approved at L3 and submitted for your L2 review.`)
        await this.notifyStakeholders(
          projectId,
          `Your valuation report for project ${projectId} has completed its first review and is now progressing to the next stage.`,
          `The valuation report for project ${projectId} has completed its first review and is now progressing to the next stage.`,
        )
      } else if (status === 'pending_l1') {
        await notifyRole('Manager L1', `Project ${projectId} has been approved at L2 and submitted for your L1 review.`)
        await this.notifyStakeholders(
          projectId,
          `Your valuation report for project ${projectId} has completed its second review and is now undergoing final review.`,
          `The valuation report for project ${projectId} has completed its second review and is now undergoing final review.`,
        )
      }
      else if (status === 'rejected_l3') await notifyRole('Manager L3', `Project ${projectId} has been returned to you by Manager L2 for corrections.`)
      else if (status === 'rejected_l2') await notifyRole('Manager L2', `Project ${projectId} has been returned to you by Manager L1 for corrections.`)
      else if (status === 'rejected_to_to') {
        // Send back to the technical officer assigned to this project.
        const to = (await this.db.query(
          `SELECT technical_officer_id FROM valuations WHERE project_id = $1 AND technical_officer_id <> '' ORDER BY valuation_id DESC LIMIT 1`,
          [projectId],
        )).rows[0]?.technical_officer_id as string | undefined
        if (to) await this.notifications.create(to, `Project ${projectId} has been returned to you by Manager L3 for corrections.`)
      } else if (status === 'locked') {
        // Report finalised by L1: move the project forward, notify + email the
        // applicant (asking for payment), and notify + email the bank.
        const proj = (await this.db.query(`SELECT applicant_nic, bank_email FROM projects WHERE project_id = $1`, [projectId])).rows[0] as Row
        await this.db.query(`UPDATE projects SET status = $1 WHERE project_id = $2`, ['Report Created — Pending Payment', projectId])
        if (proj?.applicant_nic) {
          await this.notifications.create(
            proj.applicant_nic,
            `Your valuation report for project ${projectId} has been finalised. Please complete the payment to access it.`,
          )
          const email = (await this.db.query(
            `SELECT email FROM users WHERE nic = $1 AND role = 'Loan Applicant' LIMIT 1`, [proj.applicant_nic],
          )).rows[0]?.email as string | undefined
          if (email) await this.mail.sendReportFinalised(email, projectId, 'applicant')
        }
        const bankEmail = (proj?.bank_email as string) ?? ''
        if (bankEmail) {
          await this.mail.sendReportFinalised(bankEmail, projectId, 'bank')
          const bankUserId = await this.notifications.resolveBankUserId(bankEmail)
          if (bankUserId) {
            await this.notifications.create(
              bankUserId,
              `The valuation report for project ${projectId} has been finalised and will be available to view once payment is received.`,
            )
          }
        }
      }
    } catch (err) {
      this.logger.error(`Review notification failed: ${(err as Error).message}`)
    }
  }
}
