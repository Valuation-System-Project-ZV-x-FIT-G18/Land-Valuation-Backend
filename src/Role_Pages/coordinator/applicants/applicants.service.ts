import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import { findDuplicateUserField } from '../../../Common_Pages/database/unique-user-check'
import { RegisterApplicantDto } from './dto/register-applicant.dto'
import { UpdateApplicantDto } from './dto/update-applicant.dto'
import { toStoredPhone } from '../../../Common_Pages/validation/patterns'

// Loan applicants are stored in the shared `users` table with role 'Loan Applicant'.
// The NIC is used as their user_id (login id for external login).
@Injectable()
export class ApplicantsService {
  private readonly logger = new Logger(ApplicantsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}



  // Every registered loan applicant, with how many property projects each one
  // has. The coordinator's Applicants page opens on this list so the roster is
  // browsable, instead of only reachable by typing an exact NIC.
  async listAll() {
    const result = await this.db.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.nic, u.email, u.phone,
              u.district, u.city, u.applicant_business_name,
              COUNT(p.project_id) AS project_count
         FROM users u
         LEFT JOIN projects p ON p.applicant_nic = u.nic
        WHERE u.role = 'Loan Applicant'
        GROUP BY u.user_id, u.first_name, u.last_name, u.nic, u.email, u.phone,
                 u.district, u.city, u.applicant_business_name
        ORDER BY u.first_name, u.last_name`,
    )
    return result.rows.map((row) => ({
      userId: row.user_id as string,
      name: `${row.first_name} ${row.last_name}`.trim(),
      nic: row.nic as string,
      email: (row.email as string) ?? '',
      phone: (row.phone as string) ?? '',
      district: (row.district as string) ?? '',
      city: (row.city as string) ?? '',
      applicantBusinessName: (row.applicant_business_name as string) ?? '',
      projectCount: Number(row.project_count ?? 0),
    }))
  }

  // Find a registered loan applicant by NIC.
  async findByNic(nic: string) {
    const result = await this.db.query(
      `SELECT user_id, first_name, last_name, initials, applicant_business_name, nic, email, phone,
              to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
              province, district, city, postal_code, address
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
      dateOfBirth: (row.date_of_birth as string) ?? '',
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

    // Generate credentials on the trusted server. This satisfies the strong
    // password policy and avoids exposing password creation in the UI.
    const temporaryPassword = `Ap7@${randomBytes(12).toString('base64url')}`
    const passwordHash = await bcrypt.hash(temporaryPassword, 10)
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
      await this.mail.sendApplicantWelcome(data.email, temporaryPassword)
      await this.notifications.create(
        data.nic.trim(),
        'You have been registered as a Loan Applicant on CODEHUB Land Valuation. Please change your password on first login.',
      )
    } catch (err) {
      this.logger.warn(`Applicant post-register notice failed: ${(err as Error).message}`)
    }

    return this.findByNic(data.nic)
  }

  // Correct an existing applicant's details. The NIC (their user_id / login id)
  // is fixed and identifies the row; everything else here can be edited.
  async update(nic: string, data: UpdateApplicantDto) {
    const existing = await this.findByNic(nic)
    if (!existing) throw new NotFoundException('No applicant found for that NIC.')

    // The email must stay unique across all accounts — but the applicant may
    // keep their own email, so exclude their own row (user_id = NIC) from the check.
    const dup = await findDuplicateUserField(this.db, { email: data.email }, existing.userId)
    if (dup === 'email') throw new BadRequestException('That email is already registered to another account.')

    await this.db.query(
      `UPDATE users
          SET first_name = $2, last_name = $3, initials = $4, applicant_business_name = $5,
              email = $6, phone = $7
        WHERE nic = $1 AND role = 'Loan Applicant'`,
      [
        nic.trim(),
        data.firstName.trim(),
        data.lastName.trim(),
        data.initials.trim(),
        (data.applicantBusinessName ?? '').trim(),
        data.email.trim(),
        toStoredPhone(data.phone),
      ],
    )

    return this.findByNic(nic)
  }
}
