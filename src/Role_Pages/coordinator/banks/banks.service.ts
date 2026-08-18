import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import { findDuplicateUserField } from '../../../Common_Pages/database/unique-user-check'
import { CreateBankDto } from './dto/create-bank.dto'

// Registry of bank branches / officers who request valuations.
@Injectable()
export class BanksService implements OnModuleInit {
  private readonly logger = new Logger(BanksService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS banks (
           id           SERIAL PRIMARY KEY,
           bank_name    VARCHAR(120) NOT NULL,
           branch_name  VARCHAR(120) NOT NULL DEFAULT '',
           branch_code  VARCHAR(40)  NOT NULL,
           officer_name VARCHAR(120) NOT NULL DEFAULT '',
           officer_nic  VARCHAR(20)  NOT NULL DEFAULT '',
           contact      VARCHAR(20)  NOT NULL DEFAULT '',
           email        VARCHAR(160) NOT NULL DEFAULT '',
           address      TEXT         NOT NULL DEFAULT '',
           project_ref  VARCHAR(20)  NOT NULL DEFAULT '', -- applicant NIC or Project ID
           created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
           UNIQUE (branch_code)
         )`,
      )
      await this.db.query(
        `ALTER TABLE banks ADD COLUMN IF NOT EXISTS project_ref VARCHAR(20) NOT NULL DEFAULT ''`,
      )
    } catch (err) {
      this.logger.error(`Banks setup failed: ${(err as Error).message}`)
    }
  }

  // The project reference must match a registered applicant (NIC) or a Project ID.
  private async refExists(ref: string) {
    const v = ref.trim()
    if (!v) return false
    const r = await this.db.query(
      `SELECT 1 FROM users WHERE nic = $1 AND role = 'Loan Applicant'
        UNION SELECT 1 FROM projects WHERE project_id = $1 LIMIT 1`,
      [v],
    )
    return r.rows.length > 0
  }

  async register(dto: CreateBankDto) {
    if (!(await this.refExists(dto.projectRef))) {
      return {
        ok: false,
        error: 'No applicant or project found for that NIC / Project ID.',
      }
    }
    try {
      const r = await this.db.query(
        `INSERT INTO banks
           (bank_name, branch_name, branch_code, officer_name, officer_nic, contact,
            email, address, project_ref)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          dto.bankName.trim(),
          (dto.branchName ?? '').trim(),
          dto.branchCode.trim(),
          dto.officerName.trim(),
          dto.officerNic.trim(),
          dto.contact.trim(),
          (dto.email ?? '').trim(),
          (dto.address ?? '').trim(),
          dto.projectRef.trim(),
        ],
      )
      // Create a login only when the bank supplied its email sign-in credential.
      // The branch code remains the account's internal user_id.
      const branchCode = dto.branchCode.trim()
      const email = (dto.email ?? '').trim()
      if (email) {
        try {
        // No two accounts may share a NIC or email — if the officer's NIC/email
        // is already used by another account, skip creating this login (the
        // bank record above is still saved either way).
          const dup = await findDuplicateUserField(this.db, { nic: dto.officerNic, email })
          if (dup) {
            this.logger.warn(`Bank login not created: ${dup} already registered to another account.`)
          } else {
            const password = `Bank@${Math.floor(1000 + Math.random() * 9000)}`
            const hash = await bcrypt.hash(password, 10)
            const ins = await this.db.query(
            `INSERT INTO users (user_id, first_name, last_name, nic, role, email, password_hash, must_change_password)
             VALUES ($1, $2, '', $3, 'Bank', $4, $5, true)
             ON CONFLICT (user_id) DO NOTHING
             RETURNING user_id`,
              [branchCode, dto.bankName.trim(), dto.officerNic.trim(), email, hash],
            )
            if (ins.rows.length) {
              void this.mail.sendBankWelcome(email, password, dto.bankName.trim())
            }
          }
        } catch (e) {
          this.logger.warn(`Bank login not created: ${(e as Error).message}`)
        }
      }
      // In-system notifications still use the branch code as the internal ID.
      await this.notifications.create(
        branchCode,
        `${dto.bankName.trim()} (branch ${branchCode}) has been registered on CODEHUB Land Valuation.`,
      )
      return { ok: true, id: Number(r.rows[0].id) }
    } catch (err) {
      // Most likely a duplicate branch code (UNIQUE constraint).
      if ((err as { code?: string }).code === '23505') {
        return { ok: false, error: 'That branch code is already registered.' }
      }
      this.logger.error(`Bank registration failed: ${(err as Error).message}`)
      return { ok: false, error: 'Could not register the bank.' }
    }
  }

  // All bank accounts (created by the admin, stored on the users table) for the
  // New Valuation bank/branch dropdowns.
  async registeredBanks() {
    const r = await this.db.query(
      `SELECT bank_name, branch_name, user_id, first_name, last_name, phone, email, designation
         FROM users WHERE role = 'Bank' ORDER BY bank_name, branch_name`,
    )
    return r.rows.map((u) => ({
      bankName: (u.bank_name as string) || (u.first_name as string) || '—',
      branchName: (u.branch_name as string) || '',
      branchCode: u.user_id as string,
      personName: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
      designation: (u.designation as string) || '',
      contact: (u.phone as string) || '',
      email: (u.email as string) || '',
    }))
  }

  // Banks registered against a reference (an applicant NIC or a Project ID).
  // If a Project ID is given, its applicant NIC is also matched.
  async findByRef(ref: string) {
    const v = (ref ?? '').trim()
    if (!v) return []
    const proj = await this.db.query(`SELECT applicant_nic FROM projects WHERE project_id = $1 LIMIT 1`, [v])
    const nic = proj.rows[0]?.applicant_nic as string | undefined
    const where = nic ? 'project_ref = $1 OR project_ref = $2' : 'project_ref = $1'
    const params = nic ? [v, nic] : [v]
    const r = await this.db.query(
      `SELECT id, bank_name, branch_name, branch_code, officer_name, officer_nic,
              contact, email, address, project_ref, created_at
         FROM banks WHERE ${where} ORDER BY created_at DESC`,
      params,
    )
    return this.mapBanks(r.rows)
  }

  async list() {
    const r = await this.db.query(
      `SELECT id, bank_name, branch_name, branch_code, officer_name, officer_nic,
              contact, email, address, project_ref, created_at
         FROM banks ORDER BY created_at DESC`,
    )
    return this.mapBanks(r.rows)
  }

  private mapBanks(rows: Record<string, any>[]) {
    return rows.map((b) => ({
      id: Number(b.id),
      bankName: b.bank_name as string,
      branchName: b.branch_name as string,
      branchCode: b.branch_code as string,
      officerName: b.officer_name as string,
      officerNic: b.officer_nic as string,
      contact: b.contact as string,
      email: b.email as string,
      address: b.address as string,
      projectRef: b.project_ref as string,
      createdAt: b.created_at as string,
    }))
  }
}
