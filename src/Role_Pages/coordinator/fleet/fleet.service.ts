import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'

const TO_ASSIGNED = 'Technical Officer Assigned'
const TO_ACCEPTED = 'Assignment Accepted'

const todayIso = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

// Fleet management for the coordinator: the pool of technical officers and the
// work (valuations) waiting to be assigned to them.
@Injectable()
export class FleetService {
  private readonly logger = new Logger(FleetService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  // Ensure the columns/tables this feature needs exist (safe to re-run).


  // Shared shape for a technical officer row.
  private officer(row: Record<string, unknown>) {
    return {
      userId: row.user_id as string,
      nic: row.nic as string,
      name: `${row.first_name} ${row.last_name}`,
      district: row.district as string,
      phone: row.phone as string,
      email: row.email as string,
    }
  }

  // Delete leaves whose day has passed, so an officer is only "on leave" on the
  // marked date and is automatically free again afterwards. NULL dates (ongoing)
  // are kept. Run lazily on every fleet read.
  private async purgePastLeaves() {
    try {
      await this.db.query(`DELETE FROM to_leaves WHERE leave_date < CURRENT_DATE`)
    } catch (err) {
      this.logger.warn(`Leave purge failed: ${(err as Error).message}`)
    }
  }

  // The officer categories shown on the fleet pages.
  async officers() {
    await this.purgePastLeaves()
    const all = await this.db.query(
      `SELECT user_id, nic, first_name, last_name, district, phone, email
         FROM users
        WHERE role = 'Technical Officer'
        ORDER BY first_name, last_name`,
    )

    // An officer is unavailable only while actively assigned to open work or on
    // leave today. A *rejected* assignment doesn't tie the officer up — it just
    // needs a coordinator to review it (see the `rejected` list below) — so it
    // must NOT also block them from being offered new work elsewhere.
    const available = await this.db.query(
      `SELECT user_id, nic, first_name, last_name, district, phone, email
         FROM users
        WHERE role = 'Technical Officer'
          AND user_id NOT IN (
            SELECT technical_officer_id FROM valuations
             WHERE status IN ($1, $2) AND technical_officer_id <> '')
          AND user_id NOT IN (
            SELECT to_id FROM to_leaves
             WHERE status = 'Approved' AND (leave_date = CURRENT_DATE OR leave_date IS NULL))
        ORDER BY first_name, last_name`,
      [TO_ASSIGNED, TO_ACCEPTED],
    )

    const assigned = await this.db.query(
      `SELECT u.user_id, u.nic, u.first_name, u.last_name, u.district, u.phone, u.email,
              v.project_id, v.id AS row_id, v.valuation_id, v.status,
              to_char(v.assigned_date, 'YYYY-MM-DD') AS assigned_date, v.assigned_time, p.property_number, p.street_name,
              p.village_town, p.property_city, p.district AS property_district
         FROM valuations v
         JOIN users u ON u.user_id = v.technical_officer_id
         JOIN projects p ON p.project_id = v.project_id
        WHERE v.status IN ($1, $2) AND v.technical_officer_id <> ''
        ORDER BY v.project_id`,
      [TO_ASSIGNED, TO_ACCEPTED],
    )

    const onLeave = await this.db.query(
      `SELECT u.user_id, u.nic, u.first_name, u.last_name, u.district, u.phone, u.email,
              l.reason, l.leave_date
         FROM to_leaves l
         JOIN users u ON u.user_id = l.to_id
        WHERE l.status = 'Approved' AND (l.leave_date = CURRENT_DATE OR l.leave_date IS NULL)
        ORDER BY u.first_name, u.last_name`,
    )

    const rejected = await this.db.query(
      `SELECT u.user_id, u.nic, u.first_name, u.last_name, u.district, u.phone, u.email,
              v.rejection_reason AS reason, v.project_id, v.id AS row_id
         FROM valuations v
         JOIN users u ON u.user_id = v.technical_officer_id
        WHERE v.status = 'Rejected'
        ORDER BY v.project_id`,
    )

    return {
      all: all.rows.map((r) => this.officer(r)),
      available: available.rows.map((r) => this.officer(r)),
      assigned: assigned.rows.map((r) => ({
        ...this.officer(r),
        projectId: r.project_id as string,
        valuationRowId: Number(r.row_id),
        valuationId: Number(r.valuation_id),
        status: r.status as string,
        assignedDate: (r.assigned_date as string) ?? '',
        assignedTime: (r.assigned_time as string) ?? '',
        propertyLocation: [
          r.property_number, r.street_name, r.village_town,
          r.property_city, r.property_district,
        ].filter(Boolean).join(', '),
      })),
      onLeave: onLeave.rows.map((r) => ({ ...this.officer(r), reason: r.reason as string })),
      rejected: rejected.rows.map((r) => ({
        ...this.officer(r),
        reason: r.reason as string,
        projectId: r.project_id as string,
        valuationRowId: Number(r.row_id),
      })),
    }
  }

  // Valuations still waiting for a technical officer + the officers free today.
  async unassigned() {
    const v = await this.db.query(
      `SELECT id AS row_id, valuation_id, project_id, applicant_nic
         FROM valuations
        WHERE technical_officer_id IS NULL
          AND status <> 'Rejected'
        ORDER BY created_at DESC`,
    )
    const officers = await this.officers()
    return {
      valuations: v.rows.map((r) => ({
        valuationRowId: Number(r.row_id),
        valuationId: Number(r.valuation_id),
        projectId: r.project_id as string,
        nic: r.applicant_nic as string,
      })),
      officers: officers.available,
    }
  }

  // Search work by NIC or Project ID → the applicant's projects, each with its
  // valuations and (if any) the officer already assigned. Drives the drill-down
  // assign flow: pick a project → pick a valuation → assign, or view who has it.
  async searchWork(query: string) {
    const q = (query ?? '').trim()
    if (!q) return { projects: [] }

    const projs = await this.db.query(
      `SELECT p.project_id, p.applicant_nic, u.first_name, u.last_name
         FROM projects p
         LEFT JOIN users u ON u.nic = p.applicant_nic AND u.role = 'Loan Applicant'
        WHERE p.project_id = $1 OR p.applicant_nic = $1
        ORDER BY p.project_id`,
      [q],
    )

    const projects: Array<{
      projectId: string
      nic: string
      ownerName: string
      valuations: Array<{
        rowId: number
        valuationId: number
        status: string
        assigned: boolean
        officerId: string
        officerName: string
        officerPhone: string
        date: string
        time: string
      }>
    }> = []
    for (const p of projs.rows) {
      const vals = await this.db.query(
        `SELECT v.id, v.valuation_id, v.status, v.technical_officer_id,
                to_char(v.assigned_date, 'YYYY-MM-DD') AS assigned_date, v.assigned_time,
                o.first_name AS o_first, o.last_name AS o_last, o.phone AS o_phone
           FROM valuations v
           LEFT JOIN users o ON o.user_id = v.technical_officer_id
          WHERE v.project_id = $1
          ORDER BY v.valuation_id`,
        [p.project_id],
      )
      projects.push({
        projectId: p.project_id as string,
        nic: p.applicant_nic as string,
        ownerName: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        valuations: vals.rows.map((v) => {
          const officerId = (v.technical_officer_id as string) || ''
          return {
            rowId: Number(v.id),
            valuationId: Number(v.valuation_id),
            status: v.status as string,
            assigned: officerId !== '',
            officerId,
            officerName: officerId ? `${v.o_first ?? ''} ${v.o_last ?? ''}`.trim() : '',
            officerPhone: officerId ? ((v.o_phone as string) || '') : '',
            date: (v.assigned_date as string) || '',
            time: (v.assigned_time as string) || '',
          }
        }),
      })
    }
    return { projects }
  }

  // Assign a valuation to a technical officer on a chosen date/time.
  async assign(rowId: string, toId: string, date: string, time: string) {
    const n = Number(rowId)
    if (!Number.isInteger(n)) return { ok: false, error: 'Invalid valuation.' }
    if (!toId.trim()) return { ok: false, error: 'Select a technical officer.' }
    if (!date.trim() || !time.trim()) return { ok: false, error: 'Pick a date and time.' }
    if (date.trim() < todayIso()) return { ok: false, error: 'Visit date cannot be before today.' }
    if (time.trim() < '08:00' || time.trim() > '17:00') {
      return { ok: false, error: 'Visit time must be between 8:00 AM and 5:00 PM.' }
    }
    const v = await this.db.query(
      `UPDATE valuations
          SET technical_officer_id = $1, status = $2, assigned_date = $3, assigned_time = $4
        WHERE id = $5
        RETURNING project_id, valuation_id, applicant_nic`,
      [toId.trim(), TO_ASSIGNED, date.trim(), time.trim(), n],
    )
    const row = v.rows[0]
    if (!row) return { ok: false, error: 'Valuation not found.' }
    const projectId = row.project_id as string

    // Move the project forward in its lifecycle.
    await this.db.query(`UPDATE projects SET status = $1 WHERE project_id = $2`, [
      TO_ASSIGNED,
      projectId,
    ])

    // Notify everyone involved (never blocks the assignment on failure).
    await this.notifyAssignment(
      toId.trim(),
      projectId,
      (row.applicant_nic as string) ?? '',
      date.trim(),
      time.trim(),
    )
    return { ok: true, projectId, valuationId: Number(row.valuation_id) }
  }

  // Accept a technical officer's rejection: unassign the valuation so the
  // officer returns to the "available" pool.
  async acceptRejection(rowId: string) {
    const n = Number(rowId)
    if (!Number.isInteger(n)) return { ok: false, error: 'Invalid valuation.' }
    await this.db.query(
      `UPDATE valuations
          SET technical_officer_id = NULL, assigned_date = NULL, assigned_time = NULL,
              status = 'Created', rejection_reason = ''
        WHERE id = $1`,
      [n],
    )
    return { ok: true }
  }

  // A technical officer rejects an assigned project (moves them from Assigned to
  // the Rejected pool until a coordinator accepts it). Notifies the coordinators,
  // and the applicant + bank that the visit is being rescheduled.
  async rejectAssignment(rowId: string, toId: string, reason: string) {
    const n = Number(rowId)
    if (!Number.isInteger(n)) return { ok: false, error: 'Invalid assignment.' }
    const r = await this.db.query(
      `UPDATE valuations SET status = 'Rejected', rejection_reason = $1
        WHERE id = $2 AND technical_officer_id = $3 AND status = $4
       RETURNING project_id`,
      [reason.trim() || 'No reason given', n, toId.trim(), TO_ASSIGNED],
    )
    if (!r.rows[0]) return { ok: false, error: 'Assignment not found or already actioned.' }
    const projectId = r.rows[0].project_id as string
    await this.notifyCoordinators(
      `Technical Officer ${toId} rejected project ${projectId}: ${reason.trim() || 'no reason'}.`,
    )
    await this.notifyRescheduling(projectId)
    return { ok: true }
  }

  // Tell the applicant + bank their site visit is being rescheduled — kept
  // neutral (no internal rejection reason) since a new officer will be
  // assigned shortly. Never throws.
  private async notifyRescheduling(projectId: string) {
    try {
      const proj = (await this.db.query(`SELECT applicant_nic, bank_email FROM projects WHERE project_id = $1`, [projectId]))
        .rows[0] as { applicant_nic?: string; bank_email?: string } | undefined
      const message = `The site inspection for project ${projectId} is being rescheduled. We will notify you once a new technical officer is assigned.`
      if (proj?.applicant_nic) await this.notifications.create(proj.applicant_nic, message)
      const bankEmail = proj?.bank_email ?? ''
      if (bankEmail) {
        const bankUserId = await this.notifications.resolveBankUserId(bankEmail)
        if (bankUserId) await this.notifications.create(bankUserId, message)
      }
    } catch (err) {
      this.logger.error(`Rescheduling notification failed: ${(err as Error).message}`)
    }
  }

  // Attendance: mark an officer as on leave for a future day.
  async markLeave(toId: string, reason: string, date: string) {
    const id = (toId ?? '').trim()
    if (!id) return { ok: false, error: 'Select an officer.' }
    const leaveDate = (date ?? '').trim()
    if (!leaveDate) return { ok: false, error: 'Pick a leave date.' }
    if (leaveDate <= todayIso()) return { ok: false, error: 'Leave date must be after today.' }
    const leaveReason = (reason ?? '').trim()
    if (!leaveReason) return { ok: false, error: 'Please enter a reason for leave.' }
    const result = await this.db.query(
      `INSERT INTO to_leaves (to_id, reason, leave_date, status) VALUES ($1, $2, $3, 'Pending')
       ON CONFLICT (to_id, leave_date) WHERE leave_date IS NOT NULL DO NOTHING
       RETURNING id`,
      [id, leaveReason, leaveDate],
    )
    if (!result.rows[0]) {
      return { ok: false, error: 'You have already marked leave for this date.' }
    }
    await this.notifyCoordinators(`Technical Officer ${id} requested leave for ${leaveDate}.`)
    return { ok: true }
  }

  // A technical officer accepts a freshly assigned project. Accepted work still
  // keeps the officer unavailable until the draft is submitted.
  async acceptAssignment(rowId: string, toId: string) {
    const n = Number(rowId)
    if (!Number.isInteger(n)) return { ok: false, error: 'Invalid assignment.' }
    const id = (toId ?? '').trim()
    if (!id) return { ok: false, error: 'Invalid officer.' }

    const current = await this.db.query(
      `SELECT status FROM valuations WHERE id = $1 AND technical_officer_id = $2 LIMIT 1`,
      [n, id],
    )
    const currentStatus = current.rows[0]?.status as string | undefined
    if (!currentStatus) return { ok: false, error: 'Assignment not found.' }
    if (currentStatus === TO_ACCEPTED) return { ok: true }
    if (currentStatus !== TO_ASSIGNED) {
      return { ok: false, error: 'This assignment has already been actioned.' }
    }

    const r = await this.db.query(
      `UPDATE valuations
          SET status = $1, rejection_reason = ''
        WHERE id = $2 AND technical_officer_id = $3 AND status = $4
       RETURNING project_id`,
      [TO_ACCEPTED, n, id, TO_ASSIGNED],
    )
    const projectId = r.rows[0]?.project_id as string | undefined
    if (!projectId) {
      const latest = await this.db.query(
        `SELECT status FROM valuations WHERE id = $1 AND technical_officer_id = $2 LIMIT 1`,
        [n, id],
      )
      return latest.rows[0]?.status === TO_ACCEPTED
        ? { ok: true }
        : { ok: false, error: 'This assignment has already been actioned.' }
    }
    await this.db.query(`UPDATE projects SET status = $1 WHERE project_id = $2`, [
      TO_ACCEPTED,
      projectId,
    ])
    await this.notifyCoordinators(`Technical Officer ${id} accepted project ${projectId}.`)
    return { ok: true }
  }

  // Marked leaves (today + upcoming). If a toId is given, only that officer's.
  async leaves(toId = '') {
    await this.purgePastLeaves()
    const id = (toId ?? '').trim()
    const r = await this.db.query(
      `SELECT l.id, l.to_id, l.reason, l.status, to_char(l.leave_date, 'YYYY-MM-DD') AS leave_date,
              u.first_name, u.last_name
         FROM to_leaves l JOIN users u ON u.user_id = l.to_id
        WHERE (l.leave_date >= CURRENT_DATE OR l.leave_date IS NULL)
          ${id ? 'AND l.to_id = $1' : ''}
        ORDER BY l.leave_date NULLS FIRST, u.first_name`,
      id ? [id] : [],
    )
    return r.rows.map((x) => ({
      id: Number(x.id),
      toId: x.to_id as string,
      name: `${x.first_name} ${x.last_name}`,
      reason: x.reason as string,
      date: (x.leave_date as string) ?? '',
      status: (x.status as string) ?? 'Pending',
    }))
  }

  async reviewLeave(id: string, status: 'Approved' | 'Rejected') {
    const n = Number(id)
    if (!Number.isInteger(n)) return { ok: false, error: 'Invalid leave.' }
    const r = await this.db.query(
      `UPDATE to_leaves
          SET status = $1
        WHERE id = $2 AND status = 'Pending'
        RETURNING to_id, leave_date`,
      [status, n],
    )
    if (!r.rows[0]) return { ok: false, error: 'Leave request not found or already reviewed.' }
    return { ok: true }
  }

  // Remove a marked leave (officer is coming after all → back to available).
  async removeLeave(id: string, expectedToId = '') {
    const n = Number(id)
    if (!Number.isInteger(n)) return { ok: false, error: 'Invalid leave.' }
    const result = await this.db.query(
      `DELETE FROM to_leaves
        WHERE id = $1
          AND ($2 = '' OR to_id = $2)
          AND ($2 = '' OR status = 'Pending')
      RETURNING id`,
      [n, expectedToId],
    )
    return result.rowCount ? { ok: true } : { ok: false, error: 'Leave request not found or cannot be removed.' }
  }

  private async notifyCoordinators(msg: string) {
    try {
      const r = await this.db.query(`SELECT user_id FROM users WHERE role = 'Coordinator'`)
      for (const u of r.rows) await this.notifications.create(u.user_id as string, msg)
    } catch (err) {
      this.logger.error(`Coordinator notification failed: ${(err as Error).message}`)
    }
  }

  // On assignment: e-mail + in-system notify the officer, the loan applicant,
  // and (best-effort) the requesting bank. Never throws.
  private async notifyAssignment(
    toId: string,
    projectId: string,
    nic: string,
    date: string,
    time: string,
  ) {
    try {
      // The assigned officer's details.
      const to = await this.db.query(
        `SELECT email, first_name, last_name FROM users WHERE user_id = $1 LIMIT 1`,
        [toId],
      )
      const officer = to.rows[0]
      const officerEmail = (officer?.email as string) ?? ''
      const officerName = officer
        ? `${officer.first_name} ${officer.last_name}`.trim()
        : toId

      // 1) Email the officer their inspection date/time.
      if (officerEmail) {
        await this.mail.sendOfficerAssignment(officerEmail, { projectId, date, time })
      }

      // 2) In-system notification to the officer (login id = user_id).
      await this.notifications.create(
        toId,
        `You have been assigned to project ${projectId} for a site inspection on ${date} at ${time}.`,
      )

      // 3) Email + in-system notify the loan applicant that a technical
      // officer is now assigned.
      if (nic) {
        const appl = await this.db.query(
          `SELECT email FROM users WHERE nic = $1 AND role = 'Loan Applicant' LIMIT 1`,
          [nic],
        )
        const applicantEmail = (appl.rows[0]?.email as string) ?? ''
        if (applicantEmail) {
          await this.mail.sendTechnicalOfficerAssigned(applicantEmail, {
            projectId,
            officerName,
            audience: 'applicant',
          })
        }
        await this.notifications.create(
          nic,
          `A technical officer (${officerName}) has been assigned to inspect the property for project ${projectId}, scheduled for ${date} at ${time}.`,
        )
      }

      // 4) In-system notify the requesting bank, if its login is resolvable
      // from the address stored on the project.
      const proj = await this.db.query(
        `SELECT bank_email FROM projects WHERE project_id = $1 LIMIT 1`,
        [projectId],
      )
      const bankEmail = (proj.rows[0]?.bank_email as string) ?? ''
      if (bankEmail) {
        const bankUserId = await this.notifications.resolveBankUserId(bankEmail)
        if (bankUserId) {
          await this.notifications.create(
            bankUserId,
            `A technical officer has been assigned to inspect the property for project ${projectId}.`,
          )
        }
      }
    } catch (err) {
      this.logger.error(`Assignment notification failed: ${(err as Error).message}`)
    }
  }
}
