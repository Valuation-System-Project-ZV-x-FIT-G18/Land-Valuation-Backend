import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'
import { PdfReportService } from '../../technical-officer/draft/pdf-report.service'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

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
    private readonly storage: ObjectStorageService,
    private readonly pdf: PdfReportService,
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
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS report_price NUMERIC(14,2) NOT NULL DEFAULT 0`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS final_report_object_key VARCHAR(1024) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS final_report_name VARCHAR(255) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS final_report_mime VARCHAR(100) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS final_report_generated_at TIMESTAMPTZ`)
      await this.db.query(`CREATE TABLE IF NOT EXISTS manager_review_activities (
        id BIGSERIAL PRIMARY KEY,
        project_id VARCHAR(20) NOT NULL,
        from_status VARCHAR(40) NOT NULL DEFAULT '',
        to_status VARCHAR(40) NOT NULL,
        actor_user_id VARCHAR(100) NOT NULL DEFAULT '',
        actor_role VARCHAR(40) NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`)
      await this.db.query(`ALTER TABLE manager_review_activities
        ADD COLUMN IF NOT EXISTS action VARCHAR(20) NOT NULL DEFAULT ''`)
      await this.db.query(`UPDATE manager_review_activities SET action = CASE
          WHEN to_status IN ('pending_l2', 'pending_l1', 'locked') THEN 'approved'
          WHEN to_status IN ('rejected_to_to', 'rejected_l3', 'rejected_l2') THEN 'rejected'
          ELSE 'updated'
        END
        WHERE action = ''`)
      await this.db.query(`CREATE INDEX IF NOT EXISTS idx_manager_review_activities_created
        ON manager_review_activities (created_at DESC)`)
      // Preserve the latest known workflow change for reports created before
      // the activity log existed. Future transitions are recorded individually.
      await this.db.query(`INSERT INTO manager_review_activities
          (project_id, action, from_status, to_status, actor_role, created_at)
        SELECT d.project_id,
          CASE
            WHEN d.review_status IN ('pending_l2', 'pending_l1', 'locked') THEN 'approved'
            ELSE 'rejected'
          END,
          '', d.review_status,
          CASE d.review_status
            WHEN 'pending_l2' THEN 'Manager L3'
            WHEN 'rejected_to_to' THEN 'Manager L3'
            WHEN 'pending_l1' THEN 'Manager L2'
            WHEN 'rejected_l3' THEN 'Manager L2'
            WHEN 'locked' THEN 'Manager L1'
            WHEN 'rejected_l2' THEN 'Manager L1'
            ELSE 'Manager'
          END,
          d.created_at
        FROM drafts d
        WHERE d.review_status IN ('pending_l2', 'rejected_to_to', 'pending_l1', 'rejected_l3', 'locked', 'rejected_l2')
          AND NOT EXISTS (
            SELECT 1 FROM manager_review_activities a WHERE a.project_id = d.project_id
          )`)
      // Reconstruct prerequisite approvals for reports that completed stages
      // before the history table was introduced. The workflow is strictly
      // L3 -> L2 -> L1, so these approvals are implied by the current state.
      await this.db.query(`INSERT INTO manager_review_activities
          (project_id, action, from_status, to_status, actor_role, created_at)
        SELECT d.project_id, 'approved', 'pending_l3', 'pending_l2', 'Manager L3', d.created_at
          FROM drafts d
         WHERE d.review_status IN ('pending_l2', 'rejected_l3', 'pending_l1', 'rejected_l2', 'locked')
           AND NOT EXISTS (
             SELECT 1 FROM manager_review_activities a
              WHERE a.project_id = d.project_id AND a.actor_role = 'Manager L3' AND a.action = 'approved'
           )`)
      await this.db.query(`INSERT INTO manager_review_activities
          (project_id, action, from_status, to_status, actor_role, created_at)
        SELECT d.project_id, 'approved', 'pending_l2', 'pending_l1', 'Manager L2', d.created_at
          FROM drafts d
         WHERE d.review_status IN ('pending_l1', 'rejected_l2', 'locked')
           AND NOT EXISTS (
             SELECT 1 FROM manager_review_activities a
              WHERE a.project_id = d.project_id AND a.actor_role = 'Manager L2' AND a.action = 'approved'
           )`)
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
  async projects(user: AuthUser, requestedLevel: string, view: 'check' | 'corrections' | 'final' | 'approved' | 'rejected' = 'check') {
    if (view === 'final' && user.role !== 'Manager L1') {
      throw new ForbiddenException('Only Manager L1 can view finalized reports.')
    }
    // Never trust a query-string level for authorization or filtering.
    const level = user.role === 'Manager L1' ? 'L1' : user.role === 'Manager L2' ? 'L2' : user.role === 'Manager L3' ? 'L3' : requestedLevel
    const actorRole = `Manager ${level}`
    const r = await this.db.query(
      `SELECT v.project_id, v.valuation_id, v.status, v.technical_officer_id,
              p.owner_name_as_per_deed, p.village_town, p.district,
              u.first_name, u.last_name,
              COALESCE(d.review_status, 'draft') AS review_status, COALESCE(d.reject_reason,'') AS reject_reason,
              d.created_at AS updated_at,
              previous_return.reason AS previous_return_reason,
              previous_return.created_at AS previous_returned_at
         FROM valuations v
         JOIN projects p ON p.project_id = v.project_id
         LEFT JOIN users u ON u.user_id = p.applicant_nic
         LEFT JOIN drafts d ON d.project_id = v.project_id
         LEFT JOIN LATERAL (
           SELECT a.reason, a.created_at
             FROM manager_review_activities a
            WHERE a.project_id = v.project_id
              AND a.actor_role = $1
              AND a.action = 'rejected'
              AND a.created_at <= d.created_at
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT 1
         ) previous_return ON true
        ORDER BY d.created_at DESC NULLS LAST, v.project_id DESC, v.valuation_id`,
      [actorRole],
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
          updatedAt: x.updated_at ? new Date(x.updated_at).toISOString() : '',
          reviewType: x.previous_returned_at ? 'recheck' : 'new',
          previousReturnReason: String(x.previous_return_reason ?? ''),
          previousReturnedAt: x.previous_returned_at ? new Date(x.previous_returned_at).toISOString() : '',
          valuations: [],
        })
      }
      map.get(x.project_id)!.valuations.push({
        valuationId: Number(x.valuation_id),
        status: x.status,
        technicalOfficerId: x.technical_officer_id ?? '',
      })
    }
    // Current-work views use current status. Approved/rejected views are audit
    // history and must remain true after the report advances to another stage.
    const CHECK: Record<string, string> = { L3: 'pending_l3', L2: 'pending_l2', L1: 'pending_l1' }
    const CORRECTIONS: Record<string, string> = { L3: 'rejected_l3', L2: 'rejected_l2' }
    let list = Array.from(map.values())
    if (view === 'approved' || view === 'rejected') {
      const history = view === 'approved'
        ? await this.db.query(
          `SELECT project_id, MAX(created_at) AS action_at
             FROM manager_review_activities
            WHERE actor_role = $1 AND action = 'approved'
            GROUP BY project_id`,
          [actorRole],
        )
        : await this.db.query(
          `SELECT rejected.project_id, rejected.action_at
             FROM (
               SELECT project_id, MAX(created_at) AS action_at
                 FROM manager_review_activities
                WHERE actor_role = $1 AND action = 'rejected'
                GROUP BY project_id
             ) rejected
            WHERE NOT EXISTS (
              SELECT 1 FROM manager_review_activities approved
               WHERE approved.project_id = rejected.project_id
                 AND approved.actor_role = $1
                 AND approved.action = 'approved'
                 AND approved.created_at > rejected.action_at
            )`,
          [actorRole],
        )
      const actionAt = new Map((history.rows as Row[]).map((row) => [
        String(row.project_id),
        row.action_at ? new Date(row.action_at).toISOString() : '',
      ]))
      list = list
        .filter((project) => actionAt.has(project.projectId))
        .map((project) => ({ ...project, workflowActionAt: actionAt.get(project.projectId) ?? '' }))
        .sort((a, b) => String(b.workflowActionAt).localeCompare(String(a.workflowActionAt)))
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

  async report(user: AuthUser, projectId: string) {
    const p = projectId.trim()
    const result = await this.db.query(
      `SELECT data->>'reportHtml' AS report_html, review_status, created_at
         FROM drafts WHERE project_id = $1`,
      [p],
    )
    const row = result.rows[0]
    if (!row) throw new NotFoundException('Draft report not found.')
    if (String(row.review_status) === 'locked' && user.role !== 'Manager L1') {
      throw new ForbiddenException('Only Manager L1 can view a finalized report.')
    }
    return {
      reportHtml: String(row.report_html ?? ''),
      reviewStatus: String(row.review_status ?? 'draft'),
      updatedAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    }
  }

  async recentActivities(limit = 8) {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 8, 1), 20)
    const result = await this.db.query(
      `SELECT project_id, action, from_status, to_status, actor_user_id, actor_role, reason, created_at
         FROM manager_review_activities
        ORDER BY created_at DESC, id DESC
        LIMIT $1`,
      [safeLimit],
    )
    return (result.rows as Row[]).map((row) => ({
      projectId: String(row.project_id),
      action: String(row.action ?? ''),
      fromStatus: String(row.from_status ?? ''),
      toStatus: String(row.to_status),
      actorUserId: String(row.actor_user_id ?? ''),
      actorRole: String(row.actor_role),
      reason: String(row.reason ?? ''),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    }))
  }

  async action(user: AuthUser, projectId: string, reportHtml: string | undefined, status: string, reason = '', valuationDate?: string, reportPrice?: number, authorization = '') {
    const p = (projectId ?? '').trim()
    if (!p || !status) return { ok: false, error: 'Missing project or status.' }
    const existing = (await this.db.query(
      `SELECT review_status, data->>'reportHtml' AS report_html FROM drafts WHERE project_id = $1`, [p],
    )).rows[0]
    if (!existing) throw new NotFoundException('Draft report not found.')
    const currentStatus = String(existing.review_status ?? 'draft')

    // Locked reports are immutable. This blocks edits, rejection and repeated
    // locking even if a caller bypasses the frontend controls.
    if (currentStatus === 'locked') {
      throw new ConflictException('This report is finalized and locked. It cannot be edited or returned.')
    }
    if (status === 'locked') {
      if (user.role !== 'Manager L1') throw new ForbiddenException('Only a Manager L1 can give final approval and lock a report.')
      if (currentStatus !== 'pending_l1') throw new ConflictException('Only a report pending L1 review can be finalized and locked.')
    }
    if (status === 'rejected_l2' && (user.role !== 'Manager L1' || currentStatus !== 'pending_l1')) {
      throw new ForbiddenException('Only Manager L1 can return a pending L1 report to L2.')
    }
    if (status === 'locked' && (!Number.isFinite(reportPrice) || Number(reportPrice) <= 0)) {
      return { ok: false, error: 'A valid report price is required before locking.' }
    }

    // Produce and persist the exact approved report before changing its state
    // to locked. If rendering/storage fails, the report remains reviewable.
    let finalReport: { objectKey: string; name: string } | null = null
    if (status === 'locked') {
      const approvedHtml = reportHtml ?? String(existing.report_html ?? '')
      if (!approvedHtml.trim()) return { ok: false, error: 'The report is empty and cannot be finalized.' }
      const pdf = await this.pdf.render(approvedHtml, p, 'final', authorization)
      const name = `Final-Valuation-Report-${p}.pdf`
      const stored = await this.storage.storeBuffer(pdf, name, 'application/pdf', `final-reports/${p}`)
      finalReport = { objectKey: stored.objectKey, name }
    }
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
    if (status === 'locked') {
      await this.db.query(
        `UPDATE drafts SET report_price = $2, final_report_object_key = $3,
                           final_report_name = $4, final_report_mime = 'application/pdf',
                           final_report_generated_at = now()
          WHERE project_id = $1`,
        [p, reportPrice, finalReport!.objectKey, finalReport!.name],
      )
    }
    if (status !== currentStatus) {
      await this.db.query(
        `INSERT INTO manager_review_activities
          (project_id, action, from_status, to_status, actor_user_id, actor_role, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          p,
          ['pending_l2', 'pending_l1', 'locked'].includes(status) ? 'approved' : 'rejected',
          currentStatus,
          status,
          user.userId,
          user.role,
          reason,
        ],
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
