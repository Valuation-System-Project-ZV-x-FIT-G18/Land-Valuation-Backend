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

  // All projects (with valuations + review status). `view` splits the two lists:
  //  'check'       — drafts newly arrived at this level to review (pending_lX)
  //  'corrections' — drafts sent BACK to this level to fix (rejected_lX)
  async projects(level: string, view: 'check' | 'corrections' | 'final' = 'check') {
    const r = await this.db.query(
      `SELECT v.project_id, v.valuation_id, v.status, v.technical_officer_id,
              p.owner_name_as_per_deed, p.village_town, p.district,
              u.first_name, u.last_name,
              COALESCE(d.review_status, 'draft') AS review_status, COALESCE(d.reject_reason,'') AS reject_reason
         FROM valuations v
         JOIN projects p ON p.project_id = v.project_id
         LEFT JOIN users u ON u.user_id = p.applicant_nic
         LEFT JOIN drafts d ON d.project_id = v.project_id
        ORDER BY v.project_id, v.valuation_id`,
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
    // "Final" = locked reports (L1 only).
    const CHECK: Record<string, string> = { L3: 'pending_l3', L2: 'pending_l2', L1: 'pending_l1' }
    const CORRECTIONS: Record<string, string> = { L3: 'rejected_l3', L2: 'rejected_l2' }
    const want =
      view === 'final'
        ? 'locked'
        : view === 'corrections'
          ? CORRECTIONS[level] ?? ''
          : CHECK[level] ?? ''
    let list = Array.from(map.values())
    if (want) list = list.filter((p) => p.reviewStatus === want)
    else list = [] // e.g. no corrections list for L1
    return list
  }

  // Save the (edited) report + move the draft to a new review status.
  async action(projectId: string, reportHtml: string | undefined, status: string, reason = '') {
    const p = (projectId ?? '').trim()
    if (!p || !status) return { ok: false, error: 'Missing project or status.' }
    if (reportHtml != null) {
      await this.db.query(
        `INSERT INTO drafts (project_id, data, review_status, reject_reason)
         VALUES ($1, jsonb_build_object('reportHtml', $2::text), $3, $4)
         ON CONFLICT (project_id) DO UPDATE SET
           data = COALESCE(drafts.data, '{}'::jsonb) || jsonb_build_object('reportHtml', $2::text),
           review_status = $3, reject_reason = $4, created_at = now()`,
        [p, reportHtml, status, reason],
      )
    } else {
      await this.db.query(
        `INSERT INTO drafts (project_id, review_status, reject_reason) VALUES ($1, $2, $3)
         ON CONFLICT (project_id) DO UPDATE SET review_status = $2, reject_reason = $3`,
        [p, status, reason],
      )
    }
    await this.notifyAction(p, status)
    return { ok: true }
  }
}
