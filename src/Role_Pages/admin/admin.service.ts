import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
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
  Bank: 'Bnk',
}

// Roles the system only ever has ONE of. Technical Officer, Bank and Loan
// Applicant are unlimited (any number of them can be registered).
const SINGLETON_ROLES = ['Admin', 'Coordinator', 'Manager L1', 'Manager L2', 'Manager L3']

// Admin actions: create new staff accounts.
@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  // A Bank account keeps its bank/branch name on the users row (no separate table).
  async onModuleInit() {
    try {
      await this.db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_name TEXT NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS designation TEXT NOT NULL DEFAULT ''`)
    } catch (err) {
      this.logger.error(`Could not ensure bank columns: ${(err as Error).message}`)
    }

    // No two accounts (of any role) may share a NIC or email. Blank values are
    // excluded so accounts without one (e.g. a Bank login with no email) don't
    // collide with each other.
    try {
      await this.db.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS users_nic_unique ON users (nic) WHERE nic <> ''`,
      )
      await this.db.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (LOWER(email)) WHERE email <> ''`,
      )
    } catch (err) {
      this.logger.error(`Could not ensure NIC/email uniqueness: ${(err as Error).message}`)
    }
  }

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

  async addRole(dto: CreateRoleDto) {
    // Admin, Coordinator and each Manager level may only exist once system-wide.
    if (SINGLETON_ROLES.includes(dto.role)) {
      const existing = await this.db.query(`SELECT 1 FROM users WHERE role = $1 LIMIT 1`, [
        dto.role,
      ])
      if (existing.rows.length) {
        throw new BadRequestException(`A ${dto.role} account already exists. Only one is allowed.`)
      }
    }

    // A Bank logs in with its Branch Code, so that becomes its login ID; other
    // roles get an auto-generated prefixed ID (Cor001, TO001, ...).
    let userId: string
    if (dto.role === 'Bank') {
      const code = (dto.branchCode ?? '').trim()
      if (!code) throw new BadRequestException('Branch Code is required for a Bank account.')
      const exists = await this.db.query(`SELECT 1 FROM users WHERE user_id = $1`, [code])
      if (exists.rows.length) throw new BadRequestException('That Branch Code is already registered.')
      userId = code
    } else {
      userId = await this.nextUserId(dto.role)
    }
    // No two accounts may share a NIC or email.
    const dup = await findDuplicateUserField(this.db, { nic: dto.nic, email: dto.email })
    if (dup === 'nic') throw new BadRequestException('That NIC is already registered to another account.')
    if (dup === 'email') throw new BadRequestException('That email is already registered to another account.')

    const passwordHash = await bcrypt.hash(dto.password, 10)

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
          (dto.initials ?? '').trim(),
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

    // Email the new staff member their login id + password.
    await this.mail.sendStaffWelcome(dto.email.trim(), userId, dto.password, dto.role)

    return { userId }
  }

  // Every registered account, for the Admin > User Details page.
  async listUsers() {
    const r = await this.db.query(
      `SELECT user_id, first_name, last_name, role, email, phone, nic,
              province, district, city, photo_path
         FROM users ORDER BY role, user_id`,
    )
    return r.rows.map((u) => ({
      userId: u.user_id as string,
      name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
      role: u.role as string,
      email: (u.email as string) ?? '',
      phone: (u.phone as string) ?? '',
      nic: (u.nic as string) ?? '',
      province: (u.province as string) ?? '',
      district: (u.district as string) ?? '',
      city: (u.city as string) ?? '',
      photoPath: (u.photo_path as string) ?? '',
    }))
  }

  // Edit a user's details. Login ID, NIC and email stay fixed.
  async updateUser(userId: string, dto: UpdateUserDto) {
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
  }

  // Remove a user's account entirely.
  async deleteUser(userId: string) {
    await this.db.query(`DELETE FROM users WHERE user_id = $1`, [userId])
  }
}
