import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { DatabaseService } from '../../Common_Pages/database/database.service'
import { MailService } from '../../Common_Pages/mail/mail.service'
import { findDuplicateUserField } from '../../Common_Pages/database/unique-user-check'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { toStoredPhone } from '../../Common_Pages/validation/patterns'

// Login-ID prefix for each staff role (matches the internal login page).
const PREFIX: Record<string, string> = {
  Admin: 'Adm',
  Coordinator: 'Cor',
  'Technical Officer': 'TO',
  'Manager L1': 'ML1',
  'Manager L2': 'ML2',
  'Manager L3': 'ML3',
}

// Roles the system only ever has ONE of. Technical Officer, Bank and Loan
// Applicant are unlimited (any number of them can be registered).
const SINGLETON_ROLES = ['Admin', 'Coordinator', 'Manager L1', 'Manager L2', 'Manager L3']

const generateTemporaryPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%&*?'
  const all = upper + lower + digits + symbols
  const pick = (set: string) => set[randomInt(set.length)]
  const characters = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  while (characters.length < 14) characters.push(pick(all))
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    ;[characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]]
  }
  return characters.join('')
}

const deriveInitials = (firstName: string, lastName: string) => {
  const first = firstName.trim().split(/\s+/).filter(Boolean)
  const surname = lastName.trim()
  const initials = first.map((part) => `${part[0].toUpperCase()}.`).join(' ')
  return `${initials} ${surname}`.trim()
}

// Admin actions: create new staff accounts.
@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  async onModuleInit() {
    try {
      // bank_contacts is read by the coordinator's valuation form, but it is
      // absent from schema.sql and nothing creates it — so saving a branch
      // contact would fail on a fresh database. Ensure it the way the other
      // features ensure their own tables.
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS bank_contacts (
           id          SERIAL PRIMARY KEY,
           branch_id   INTEGER NOT NULL REFERENCES bank_branches(id) ON DELETE CASCADE,
           full_name   TEXT NOT NULL DEFAULT '',
           phone       TEXT NOT NULL DEFAULT '',
           email       TEXT NOT NULL DEFAULT '',
           designation TEXT NOT NULL DEFAULT '',
           created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      )
      await this.db.query(
        `CREATE INDEX IF NOT EXISTS bank_contacts_branch_idx ON bank_contacts (branch_id)`,
      )
    } catch (err) {
      this.logger.error(`Bank contacts setup failed: ${(err as Error).message}`)
    }
  }

  // A Bank account keeps its bank/branch name on the users row (no separate table).


  // Next login id for a role, e.g. Cor001 -> Cor002.
  private async nextUserId(role: string) {
    const prefix = PREFIX[role]
    if (!prefix) throw new BadRequestException('Unknown role.')
    const r = await this.db.query(`SELECT user_id FROM users WHERE user_id LIKE $1`, [
      `${prefix}%`,
    ])
    let max = 0
    for (const row of r.rows) {
      const suffix = (row.user_id as string).slice(prefix.length)
      if (/^\d+$/.test(suffix)) max = Math.max(max, parseInt(suffix, 10))
    }
    return `${prefix}${String(max + 1).padStart(3, '0')}`
  }

  private async audit(actorUserId: string, action: string, targetUserId: string, details: Record<string, unknown> = {}) {
    await this.db.query(
      `INSERT INTO admin_audit_logs (actor_user_id, action, target_user_id, details) VALUES ($1,$2,$3,$4::jsonb)`,
      [actorUserId, action, targetUserId, JSON.stringify(details)],
    )
  }

  async addRole(dto: CreateRoleDto, actorUserId: string) {
    // Admin, Coordinator and each Manager level may only exist once system-wide.
    if (SINGLETON_ROLES.includes(dto.role)) {
      const existing = await this.db.query(`SELECT 1 FROM users WHERE role = $1 LIMIT 1`, [
        dto.role,
      ])
      if (existing.rows.length) {
        throw new BadRequestException(`A ${dto.role} account already exists. Only one is allowed.`)
      }
    }

    let userId: string
    if (dto.role === 'Bank') {
      const branchCode = (dto.branchCode ?? '').trim()
      const bankName = (dto.bankName ?? '').trim()
      if (!branchCode || !bankName) {
        throw new BadRequestException('Bank name and branch code are required for a Bank account.')
      }
      const branch = await this.db.query(
        `SELECT branch.branch_code, branch.branch_name, bank.name AS bank_name
           FROM bank_branches branch
           JOIN bank_organizations bank ON bank.id = branch.bank_id
          WHERE branch.branch_code = $1 AND lower(bank.name) = lower($2)
          LIMIT 1`,
        [branchCode, bankName],
      )
      if (!branch.rows.length) {
        throw new BadRequestException('Register this bank branch in Bank Management before creating its login.')
      }
      const existingBank = await this.db.query(`SELECT 1 FROM users WHERE user_id = $1 LIMIT 1`, [branchCode])
      if (existingBank.rows.length) {
        throw new BadRequestException(`A Bank login already exists for branch ${branchCode}.`)
      }
      userId = branchCode
      dto.branchName = String(branch.rows[0].branch_name ?? dto.branchName ?? '')
      dto.bankName = String(branch.rows[0].bank_name ?? bankName)
    } else {
      userId = await this.nextUserId(dto.role)
    }
    // No two accounts may share a NIC or email.
    const dup = await findDuplicateUserField(this.db, { nic: dto.nic, email: dto.email })
    if (dup === 'nic') throw new BadRequestException('That NIC is already registered to another account.')
    if (dup === 'email') throw new BadRequestException('That email is already registered to another account.')

    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await bcrypt.hash(temporaryPassword, 10)

    // must_change_password = true -> forced to change it on first login.
    try {
      await this.db.query(
        `INSERT INTO users
           (user_id, first_name, last_name, initials, nic, role, email, phone,
            date_of_birth, province, district, city, postal_code, address, branch_name, bank_name,
            designation, password_hash, must_change_password)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true)`,
        [
          userId,
          dto.firstName.trim(),
          dto.lastName.trim(),
          deriveInitials(dto.firstName, dto.lastName),
          dto.nic.trim(),
          dto.role,
          dto.email.trim(),
          toStoredPhone(dto.phone),
          dto.dateOfBirth || null,
          (dto.province ?? '').trim(),
          (dto.district ?? '').trim(),
          (dto.city ?? '').trim(),
          (dto.postalCode ?? '').trim(),
          (dto.address ?? '').trim(),
          (dto.branchName ?? '').trim(),
          (dto.bankName ?? '').trim(),
          (dto.designation ?? '').trim(),
          passwordHash,
        ],
      )
    } catch (err) {
      // Fallback for a race where two requests pass the pre-check at once —
      // the DB's unique index is the final word.
      if ((err as { code?: string }).code === '23505') {
        throw new BadRequestException('That NIC or email is already registered to another account.')
      }
      throw err
    }

    // Email the new user their sign-in address and temporary password.
    if (dto.role === 'Bank') {
      await this.mail.sendBankWelcome(dto.email.trim(), temporaryPassword, (dto.bankName ?? '').trim())
    } else {
      await this.mail.sendStaffWelcome(dto.email.trim(), temporaryPassword, dto.role)
    }
    await this.audit(actorUserId, 'USER_CREATED', userId, { role: dto.role })

    return { userId }
  }

  // Every registered account, for the Admin > User Details page.
  async listUsers() {
    const r = await this.db.query(
      `SELECT user_id, first_name, last_name, role, email, phone, nic,
              province, district, city, photo_path, account_status, created_at, last_login_at
         FROM users ORDER BY role, user_id`,
    )
    return r.rows.map((u) => ({
      userId: u.user_id as string,
      name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
      firstName: (u.first_name as string) ?? '',
      lastName: (u.last_name as string) ?? '',
      role: u.role as string,
      email: (u.email as string) ?? '',
      phone: (u.phone as string) ?? '',
      nic: (u.nic as string) ?? '',
      province: (u.province as string) ?? '',
      district: (u.district as string) ?? '',
      city: (u.city as string) ?? '',
      photoPath: (u.photo_path as string) ?? '',
      status: u.account_status as string,
      createdAt: u.created_at as string,
      lastLoginAt: (u.last_login_at as string | null) ?? null,
    }))
  }

  // Edit a user's details. Account ID, NIC and email stay fixed.
  async updateUser(userId: string, dto: UpdateUserDto, actorUserId: string) {
    if (SINGLETON_ROLES.includes(dto.role)) {
      const existing = await this.db.query(
        `SELECT 1 FROM users WHERE role = $1 AND user_id <> $2 LIMIT 1`,
        [dto.role, userId],
      )
      if (existing.rows[0]) {
        throw new BadRequestException(`A ${dto.role} account already exists. Only one is allowed.`)
      }
    }

    await this.db.query(
      `UPDATE users SET first_name = $2, last_name = $3, role = $4, phone = $5,
              province = $6, district = $7, city = $8
        WHERE user_id = $1`,
      [
        userId,
        dto.firstName.trim(),
        (dto.lastName ?? '').trim(),
        dto.role,
        toStoredPhone(dto.phone),
        (dto.province ?? '').trim(),
        (dto.district ?? '').trim(),
        (dto.city ?? '').trim(),
      ],
    )
    await this.audit(actorUserId, 'USER_UPDATED', userId, { role: dto.role })
  }

  async updateUserStatus(
    userId: string,
    status: 'Active' | 'Suspended' | 'Deactivated',
    actorUserId: string,
  ) {
    if (userId === actorUserId && status !== 'Active') {
      throw new BadRequestException('You cannot suspend or deactivate your own account.')
    }
    const target = await this.db.query(`SELECT role, account_status FROM users WHERE user_id = $1`, [userId])
    if (!target.rows[0]) throw new BadRequestException('User account was not found.')
    if (target.rows[0].role === 'Admin' && status !== 'Active') {
      const admins = await this.db.query(
        `SELECT count(*)::int AS count FROM users WHERE role = 'Admin' AND account_status = 'Active'`,
      )
      if (Number(admins.rows[0].count) <= 1) throw new BadRequestException('The last active admin cannot be disabled.')
    }
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE users SET account_status = $2, session_version = session_version + 1 WHERE user_id = $1`,
        [userId, status],
      )
      await client.query(
        `INSERT INTO admin_audit_logs (actor_user_id, action, target_user_id, details)
         VALUES ($1,'USER_STATUS_CHANGED',$2,$3::jsonb)`,
        [actorUserId, userId, JSON.stringify({ from: target.rows[0].account_status, to: status })],
      )
    })
  }


  // Admin-initiated password reset. An admin resets a password because the old
  // one is compromised or the user is locked out, so this also bumps
  // session_version: leaving already-signed-in sessions alive would defeat the
  // point of the reset. The new password is only ever sent by email - it is not
  // returned to the admin.
  async resetUserPassword(userId: string, actorUserId: string) {
    const target = await this.db.query(
      `SELECT email, role FROM users WHERE user_id = $1 LIMIT 1`,
      [userId],
    )
    const user = target.rows[0]
    if (!user) throw new BadRequestException('User account was not found.')
    const email = ((user.email as string) ?? '').trim()
    if (!email) {
      throw new BadRequestException(
        'That account has no email address on file, so a new password cannot be sent.',
      )
    }

    const temporary = generateTemporaryPassword()
    const passwordHash = await bcrypt.hash(temporary, 10)
    await this.db.query(
      `UPDATE users
          SET password_hash = $2, must_change_password = true,
              session_version = session_version + 1
        WHERE user_id = $1`,
      [userId, passwordHash],
    )
    await this.mail.sendPasswordReset(email, temporary)
    await this.audit(actorUserId, 'USER_PASSWORD_RESET', userId, { role: user.role })
    return { email }
  }
  // The audit page filters client-side, so it needs the whole recent history in
  // one response. 100 rows covered barely a few days of activity; 1000 keeps the
  // page responsive while making the filters worth having.
  async listAuditLogs() {
    const result = await this.db.query(
      `SELECT id, actor_user_id, action, target_user_id, details, created_at
         FROM admin_audit_logs ORDER BY created_at DESC LIMIT 1000`,
    )
    return result.rows.map((row) => ({
      id: String(row.id), actorUserId: row.actor_user_id as string | null,
      action: row.action as string, targetUserId: row.target_user_id as string | null,
      details: row.details as Record<string, unknown>, createdAt: row.created_at as string,
    }))
  }

  async listBanks() {
    const result = await this.db.query(
      `SELECT bank.id, bank.name, bank.created_at,
              COALESCE(json_agg(json_build_object(
                'id', branch.id, 'branchName', branch.branch_name,
                'branchCode', branch.branch_code, 'city', branch.city,
                'contactPerson', COALESCE(contact.full_name, ''),
                'contactNumber', COALESCE(contact.phone, ''),
                'contactEmail', COALESCE(contact.email, '')
              ) ORDER BY branch.branch_name) FILTER (WHERE branch.id IS NOT NULL), '[]') AS branches
         FROM bank_organizations bank
         LEFT JOIN bank_branches branch ON branch.bank_id = bank.id
         LEFT JOIN LATERAL (
           SELECT full_name, phone, email FROM bank_contacts
            WHERE branch_id = branch.id ORDER BY id LIMIT 1
         ) contact ON true
        GROUP BY bank.id, bank.name, bank.created_at
        ORDER BY bank.name`,
    )
    return result.rows.map((row) => ({
      id: String(row.id), name: row.name as string,
      createdAt: row.created_at as string, branches: row.branches,
    }))
  }

  async createBank(name: string, actorUserId: string) {
    const cleanName = name.trim()
    if (cleanName.length < 2) throw new BadRequestException('Enter a valid bank name.')
    try {
      const result = await this.db.query(
        `INSERT INTO bank_organizations (name) VALUES ($1) RETURNING id, name, created_at`,
        [cleanName],
      )
      const bank = result.rows[0]
      await this.audit(actorUserId, 'BANK_CREATED', `BANK:${bank.id}`, { name: bank.name })
      return { id: String(bank.id), name: bank.name, createdAt: bank.created_at, branches: [] }
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new BadRequestException('That bank is already registered.')
      }
      throw error
    }
  }

  async createBankBranch(
    bankId: string, branchName: string, branchCode: string, city: string,
    contactPerson: string, contactNumber: string, contactEmail: string, actorUserId: string,
  ) {
    const name = branchName.trim()
    const code = branchCode.trim()
    const person = contactPerson.trim()
    const phone = contactNumber.trim()
    const email = contactEmail.trim().toLowerCase()
    if (!/^\d{2,10}$/.test(code)) {
      throw new BadRequestException('Enter the official numeric branch code (2–10 digits).')
    }
    if (name.length < 2) throw new BadRequestException('Enter a valid branch name.')
    if (!email) throw new BadRequestException('A contact email is required to create the Bank login.')
    const duplicateEmail = await findDuplicateUserField(this.db, { email })
    if (duplicateEmail === 'email') throw new BadRequestException('That email is already used by another account.')

    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await bcrypt.hash(temporaryPassword, 10)
    try {
      const created = await this.db.transaction(async (client) => {
        const bankResult = await client.query(
          `SELECT name FROM bank_organizations WHERE id = $1 LIMIT 1`,
          [bankId],
        )
        if (!bankResult.rows[0]) throw new BadRequestException('Bank organization was not found.')
        const bankName = String(bankResult.rows[0].name)

        const result = await client.query(
          `INSERT INTO bank_branches (bank_id, branch_code, branch_name, city)
           VALUES ($1, $2, $3, $4)
           RETURNING id, branch_name, branch_code, city`,
          [bankId, code, name, city.trim()],
        )
        const branch = result.rows[0]
        await client.query(
          `INSERT INTO bank_contacts (branch_id, full_name, phone, email) VALUES ($1, $2, $3, $4)`,
          [branch.id, person, phone, email],
        )

        const nameParts = person.split(/\s+/).filter(Boolean)
        const firstName = nameParts[0] || bankName
        const lastName = nameParts.slice(1).join(' ') || name
        await client.query(
          `INSERT INTO users
             (user_id, first_name, last_name, initials, nic, role, email, phone,
              branch_name, bank_name, designation, password_hash, must_change_password)
           VALUES ($1,$2,$3,$4,$5,'Bank',$6,$7,$8,$9,$10,$11,true)`,
          [
            code, firstName, lastName, deriveInitials(firstName, lastName),
            `BANK-${code}`, email, toStoredPhone(phone), name, bankName,
            'Bank Representative', passwordHash,
          ],
        )
        return { branch, bankName }
      })
      const { branch, bankName } = created
      await this.audit(actorUserId, 'BANK_BRANCH_CREATED', `BRANCH:${branch.id}`, {
        bankId, branchName: branch.branch_name, branchCode: branch.branch_code, loginEmail: email,
      })
      await this.mail.sendBankWelcome(email, temporaryPassword, `${bankName} - ${name} Branch`)
      return {
        id: String(branch.id), branchName: branch.branch_name,
        branchCode: branch.branch_code, city: branch.city,
        contactPerson: person, contactNumber: phone, contactEmail: email,
      }
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new BadRequestException('That branch code, login ID, email, or Bank account is already registered.')
      }
      throw error
    }
  }

  // Removing a branch is only safe while nothing points at it: a valuation
  // stores the branch *code*, and a Bank login uses that same code as its
  // user id. Deleting underneath either would strand a report with no bank.
  private async assertBranchUnused(branchCode: string) {
    const used = await this.db.query(
      `SELECT
         (SELECT COUNT(*) FROM valuations WHERE details->>'bankBranchCode' = $1) AS valuations,
         (SELECT COUNT(*) FROM users WHERE role = 'Bank' AND user_id = $1) AS accounts`,
      [branchCode],
    )
    const { valuations, accounts } = used.rows[0]
    if (Number(valuations) > 0) {
      throw new BadRequestException(
        `${valuations} valuation request(s) already use branch ${branchCode}. Remove those first.`,
      )
    }
    if (Number(accounts) > 0) {
      throw new BadRequestException(
        `A Bank login exists for branch ${branchCode}. Delete that user account first.`,
      )
    }
  }

  async deleteBankBranch(branchId: string, actorUserId: string) {
    const found = await this.db.query(
      `SELECT branch_code, branch_name FROM bank_branches WHERE id = $1`,
      [branchId],
    )
    const branch = found.rows[0]
    if (!branch) throw new BadRequestException('Branch was not found.')
    await this.assertBranchUnused(branch.branch_code as string)
    await this.db.query(`DELETE FROM bank_branches WHERE id = $1`, [branchId])
    await this.audit(actorUserId, 'BANK_BRANCH_DELETED', `BRANCH:${branchId}`, {
      branchCode: branch.branch_code, branchName: branch.branch_name,
    })
    return { ok: true }
  }

  async deleteBank(bankId: string, actorUserId: string) {
    const found = await this.db.query(`SELECT name FROM bank_organizations WHERE id = $1`, [bankId])
    const bank = found.rows[0]
    if (!bank) throw new BadRequestException('Bank was not found.')
    const branches = await this.db.query(
      `SELECT branch_code FROM bank_branches WHERE bank_id = $1`,
      [bankId],
    )
    for (const row of branches.rows) await this.assertBranchUnused(row.branch_code as string)
    await this.db.query(`DELETE FROM bank_organizations WHERE id = $1`, [bankId])
    await this.audit(actorUserId, 'BANK_DELETED', `BANK:${bankId}`, { name: bank.name })
    return { ok: true }
  }
}
