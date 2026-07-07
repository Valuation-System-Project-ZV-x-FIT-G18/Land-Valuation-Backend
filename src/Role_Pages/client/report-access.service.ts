import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../Common_Pages/database/database.service'
import { MailService } from '../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../Common_Pages/notifications/notifications.service'

type Row = Record<string, any>

// Minimum professional valuation fee (LKR) — charged when the scale fee is lower.
export const MIN_FEE = 7500

// Regressive professional-fee scale on the assessed Market Value (senior-valuer
// practice: the % reduces as the value rises). Each band is charged only on the
// portion of value that falls within it.
const FEE_SCALE: { upTo: number; rate: number }[] = [
  { upTo: 1_000_000, rate: 0.005 }, //   up to Rs. 1M      @ 0.50%
  { upTo: 5_000_000, rate: 0.0025 }, //  Rs. 1M – 5M       @ 0.25%
  { upTo: 10_000_000, rate: 0.002 }, //  Rs. 5M – 10M      @ 0.20%
  { upTo: 25_000_000, rate: 0.0015 }, // Rs. 10M – 25M     @ 0.15%
  { upTo: Number.POSITIVE_INFINITY, rate: 0.001 }, // over Rs. 25M @ 0.10%
]

// Compute the fee for a market value + a per-band breakdown to show the client.
export function computeFee(marketValue: number) {
  const mv = Math.max(0, Math.round(Number(marketValue) || 0))
  const bands: { from: number; to: number; rate: number; amount: number }[] = []
  let prev = 0
  let scaleFee = 0
  for (const s of FEE_SCALE) {
    if (mv <= prev) break
    const to = Math.min(mv, s.upTo)
    const portion = to - prev
    if (portion > 0) {
      const amount = portion * s.rate
      scaleFee += amount
      bands.push({ from: prev, to, rate: s.rate, amount: Math.round(amount) })
    }
    prev = s.upTo
  }
  scaleFee = Math.round(scaleFee)
  const minApplied = scaleFee < MIN_FEE
  // Round the payable fee up to the nearest Rs. 100.
  const fee = Math.ceil(Math.max(scaleFee, MIN_FEE) / 100) * 100
  return { marketValue: mv, bands, scaleFee, minFee: MIN_FEE, minApplied, fee }
}

// Report access for external clients: a loan applicant pays for a locked report,
// after which the requesting bank can view it.
@Injectable()
export class ReportAccessService implements OnModuleInit {
  private readonly logger = new Logger(ReportAccessService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  // On payment completion (card paid, or a slip verified): finish the valuation,
  // notify + email the applicant and the bank. Never throws.
  private async notifyPaid(projectId: string) {
    try {
      const proj = (await this.db.query(
        `SELECT applicant_nic, bank_email FROM projects WHERE project_id = $1`,
        [projectId],
      )).rows[0] as Row | undefined
      // Move the project to its final state.
      await this.db.query(`UPDATE projects SET status = $1 WHERE project_id = $2`, ['Valuation Completed', projectId])

      // Loan applicant — in-system + email.
      const nic = (proj?.applicant_nic as string) ?? ''
      if (nic) {
        await this.notifications.create(nic, `Payment received for project ${projectId}. Your valuation is complete and the report is now available to your bank.`)
        const email = (await this.db.query(
          `SELECT email FROM users WHERE nic = $1 AND role = 'Loan Applicant' LIMIT 1`, [nic],
        )).rows[0]?.email as string | undefined
        if (email) await this.mail.sendPaymentReceived(email, projectId, 'applicant')
      }

      // Bank — in-system (branch code = its login id, from the valuation) + email.
      const bankCode = (await this.db.query(
        `SELECT details->>'bankBranchCode' AS code FROM valuations WHERE project_id = $1 ORDER BY valuation_id DESC LIMIT 1`,
        [projectId],
      )).rows[0]?.code as string | undefined
      if (bankCode) {
        await this.notifications.create(bankCode, `Payment received for project ${projectId}. The finalised valuation report is now available to view.`)
        const bankEmail = (proj?.bank_email as string) ||
          ((await this.db.query(`SELECT email FROM users WHERE user_id = $1 LIMIT 1`, [bankCode])).rows[0]?.email as string | undefined) || ''
        if (bankEmail) await this.mail.sendPaymentReceived(bankEmail, projectId, 'bank')
      } else if (proj?.bank_email) {
        await this.mail.sendPaymentReceived(proj.bank_email as string, projectId, 'bank')
      }
    } catch (err) {
      this.logger.error(`Payment-received notification failed: ${(err as Error).message}`)
    }
  }

  async onModuleInit() {
    try {
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(60) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS slip_path VARCHAR(255) NOT NULL DEFAULT ''`)
      // A slip payment waits here until a coordinator verifies it.
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS slip_pending BOOLEAN NOT NULL DEFAULT false`)
    } catch (err) {
      this.logger.error(`Report access setup failed: ${(err as Error).message}`)
    }
  }

  // Locked reports for a loan applicant (their own projects) + payment state.
  async applicantProjects(nic: string) {
    const r = await this.db.query(
      `SELECT p.project_id, p.owner_name_as_per_deed, p.village_town, p.district,
              COALESCE(d.review_status,'') AS review_status, COALESCE(d.paid,false) AS paid,
              COALESCE(d.slip_pending,false) AS slip_pending, la.data AS analysis
         FROM projects p
         LEFT JOIN drafts d ON d.project_id = p.project_id
         LEFT JOIN land_analyses la ON la.project_id = p.project_id
        WHERE p.applicant_nic = $1 AND d.review_status = 'locked'
        ORDER BY p.project_id`,
      [(nic ?? '').trim()],
    )
    return r.rows.map((x: Row) => this.shape(x))
  }

  // Locked reports for the projects a bank branch requested + payment state.
  // The bank's login id IS its branch code, which is stored on the valuation
  // (bankBranchCode) when the coordinator raises it — that's the real link.
  async bankProjects(bankUserId: string) {
    const r = await this.db.query(
      `SELECT DISTINCT p.project_id, p.owner_name_as_per_deed, p.village_town, p.district,
              COALESCE(d.review_status,'') AS review_status, COALESCE(d.paid,false) AS paid,
              COALESCE(d.slip_pending,false) AS slip_pending, la.data AS analysis
         FROM valuations v
         JOIN projects p ON p.project_id = v.project_id
         LEFT JOIN drafts d ON d.project_id = p.project_id
         LEFT JOIN land_analyses la ON la.project_id = p.project_id
        WHERE v.details->>'bankBranchCode' = $1 AND d.review_status = 'locked'
        ORDER BY p.project_id`,
      [(bankUserId ?? '').trim()],
    )
    return r.rows.map((x: Row) => this.shape(x))
  }

  private shape(x: Row) {
    const analysis = (typeof x.analysis === 'string' ? JSON.parse(x.analysis || '{}') : x.analysis) ?? {}
    const marketValue = Number(analysis?.summary?.marketValue) || 0
    const f = computeFee(marketValue)
    return {
      projectId: x.project_id as string,
      ownerName: (x.owner_name_as_per_deed as string) || '—',
      location: [x.village_town, x.district].filter(Boolean).join(', '),
      locked: x.review_status === 'locked',
      paid: !!x.paid,
      slipPending: !!x.slip_pending, // slip uploaded, awaiting coordinator verification
      fee: f.fee,
      marketValue: f.marketValue,
      feeBreakdown: f.bands,
      scaleFee: f.scaleFee,
      minFee: f.minFee,
      minApplied: f.minApplied,
    }
  }

  // Card payment (demo gateway) — mark the report paid.
  async pay(projectId: string) {
    const p = (projectId ?? '').trim()
    if (!p) return { ok: false, error: 'Missing project.' }
    const ref = 'CARD-' + Date.now()
    const r = await this.db.query(
      `UPDATE drafts SET paid = true, paid_at = now(), payment_ref = $2, payment_method = 'card'
        WHERE project_id = $1 AND review_status = 'locked'`,
      [p, ref],
    )
    if (r.rowCount === 0) return { ok: false, error: 'Report is not available for payment yet.' }
    await this.notifyPaid(p)
    return { ok: true, paymentRef: ref }
  }

  // Manual bank payment — store the slip and mark it PENDING coordinator
  // verification (not paid yet). It shows as paid only after verify().
  async paySlip(projectId: string, slipFilename: string) {
    const p = (projectId ?? '').trim()
    if (!p) return { ok: false, error: 'Missing project.' }
    if (!slipFilename) return { ok: false, error: 'Please attach the payment slip.' }
    const r = await this.db.query(
      `UPDATE drafts SET payment_method = 'bank_slip', slip_path = $2, slip_pending = true
        WHERE project_id = $1 AND review_status = 'locked' AND paid = false`,
      [p, slipFilename],
    )
    if (r.rowCount === 0) return { ok: false, error: 'Report is not available for payment yet.' }
    return { ok: true }
  }

  // Slips awaiting a coordinator's verification.
  async pendingSlips() {
    const r = await this.db.query(
      `SELECT p.project_id, p.owner_name_as_per_deed, p.village_town, p.district,
              d.slip_path, to_char(d.created_at, 'YYYY-MM-DD') AS uploaded
         FROM drafts d JOIN projects p ON p.project_id = d.project_id
        WHERE d.slip_pending = true
        ORDER BY d.created_at DESC`,
    )
    return r.rows.map((x: Row) => ({
      projectId: x.project_id as string,
      ownerName: (x.owner_name_as_per_deed as string) || '—',
      location: [x.village_town, x.district].filter(Boolean).join(', '),
      slipPath: x.slip_path as string,
      uploaded: x.uploaded as string,
    }))
  }

  // Coordinator verifies (approve → paid) or rejects (clear the slip) a payment.
  async verifySlip(projectId: string, approve: boolean) {
    const p = (projectId ?? '').trim()
    if (!p) return { ok: false, error: 'Missing project.' }
    if (approve) {
      const ref = 'SLIP-' + Date.now()
      const r = await this.db.query(
        `UPDATE drafts SET paid = true, paid_at = now(), payment_ref = $2, slip_pending = false
          WHERE project_id = $1 AND slip_pending = true`,
        [p, ref],
      )
      if (r.rowCount) await this.notifyPaid(p)
    } else {
      await this.db.query(
        `UPDATE drafts SET slip_pending = false, slip_path = '', payment_method = ''
          WHERE project_id = $1 AND slip_pending = true`,
        [p],
      )
    }
    return { ok: true }
  }

  // The stored slip filename (for the coordinator to view it).
  async slipPath(projectId: string) {
    const r = await this.db.query(`SELECT slip_path FROM drafts WHERE project_id = $1`, [(projectId ?? '').trim()])
    const path = r.rows[0]?.slip_path as string | undefined
    return path || null
  }

  // Whether the bank may view a project's report (locked AND paid).
  async canView(projectId: string) {
    const r = await this.db.query(
      `SELECT review_status, paid FROM drafts WHERE project_id = $1`,
      [(projectId ?? '').trim()],
    )
    const d = r.rows[0]
    return { locked: d?.review_status === 'locked', paid: !!d?.paid }
  }
}
