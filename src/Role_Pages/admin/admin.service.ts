import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { DatabaseService } from '../../Common_Pages/database/database.service'
import { MailService } from '../../Common_Pages/mail/mail.service'
import { CreateRoleDto } from './dto/create-role.dto'

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
    const passwordHash = await bcrypt.hash(dto.password, 10)

    // must_change_password = true -> forced to change it on first login.
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
        (dto.phone ?? '').trim(),
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

    // Email the new staff member their login id + password.
    await this.mail.sendStaffWelcome(dto.email.trim(), userId, dto.password, dto.role)

    return { userId }
  }
}
