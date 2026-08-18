import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import { findDuplicateUserField } from '../../../Common_Pages/database/unique-user-check'
import { RegisterApplicantDto } from './dto/register-applicant.dto'
import { toStoredPhone } from '../../../Common_Pages/validation/patterns'

// Loan applicants are stored in the shared `users` table with role 'Loan Applicant'.
// The NIC is used as their user_id (login id for external login).
@Injectable()
export class ApplicantsService implements OnModuleInit {
  private readonly logger = new Logger(ApplicantsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS applicant_business_name VARCHAR(150) NOT NULL DEFAULT ''`)
    } catch (err) {
      this.logger.error(`Could not ensure applicant business-name field: ${(err as Error).message}`)
    }
  }

  // Find a registered loan applicant by NIC.
  async findByNic(nic: string) {
    const result = await this.db.query(
      `SELECT user_id, first_name, last_name, initials, applicant_business_name, nic, email, phone,
              date_of_birth, province, district, city, postal_code, address
         FROM users
        WHERE nic = $1 AND role = 'Loan Applicant'
        LIMIT 1`,
      [nic.trim()],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      userId: row.user_id as string,
      name: `${row.first_name} ${row.last_name}`.trim(),
      initials: (row.initials as string) ?? '',
      applicantBusinessName: (row.applicant_business_name as string) ?? '',
      nic: row.nic as string,
      email: (row.email as string) ?? '',
      phone: (row.phone as string) ?? '',
      dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : '',
      province: (row.province as string) ?? '',
      district: (row.district as string) ?? '',
      city: (row.city as string) ?? '',
      postalCode: (row.postal_code as string) ?? '',
      address: (row.address as string) ?? '',
    }
  }

  // Find an applicant by Project ID (a valuation request id, for now).
  // Resolve a Project ID (e.g. "pro003") to its loan applicant.
  async findByProjectId(projectId: string) {
    const id = (projectId ?? '').trim()
    if (!id) return null
    const pr = await this.db.query(`SELECT applicant_nic FROM projects WHERE project_id = $1 LIMIT 1`, [id])
    const nic = pr.rows[0]?.applicant_nic as string | undefined
    if (!nic) return null
    return this.findByNic(nic)
  }

  // Register a new loan applicant into the users table (user_id = NIC).
  async register(data: RegisterApplicantDto) {
    // No two accounts (of any role) may share a NIC or email.
    const dup = await findDuplicateUserField(this.db, { nic: data.nic, email: data.email })
    if (dup === 'nic') throw new BadRequestException('That NIC is already registered to another account.')
    if (dup === 'email') throw new BadRequestException('That email is already registered to another account.')

    const passwordHash = await bcrypt.hash(data.password, 10)
    try {
      await this.db.query(
        `INSERT INTO users
           (user_id, first_name, last_name, initials, applicant_business_name, nic, role, email, phone,
            date_of_birth, province, district, city, postal_code, address, password_hash,
            must_change_password)
         VALUES ($1, $2, $3, $4, $5, $1, 'Loan Applicant', $6, $7, $8, $9, $10, $11, $12, $13, $14,
            true)
         ON CONFLICT (user_id) DO NOTHING`,
        [
          data.nic.trim(),
          data.firstName.trim(),
          data.lastName.trim(),
          data.initials.trim(),
          (data.applicantBusinessName ?? '').trim(),
          data.email.trim(),
          toStoredPhone(data.phone),
          data.dateOfBirth || null,
          (data.province ?? '').trim(),
          (data.district ?? '').trim(),
          (data.city ?? '').trim(),
          (data.postalCode ?? '').trim(),
          (data.address ?? '').trim(),
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

    // Email + notification are best-effort — a mail/SMTP hiccup must NOT fail the
    // registration (the applicant is already saved above).
    try {
      await this.mail.sendApplicantWelcome(data.email, data.password)
      await this.notifications.create(
        data.nic.trim(),
        'You have been registered as a Loan Applicant on CODEHUB Land Valuation. Please change your password on first login.',
      )
    } catch (err) {
      this.logger.warn(`Applicant post-register notice failed: ${(err as Error).message}`)
    }

    return this.findByNic(data.nic)
  }
}
