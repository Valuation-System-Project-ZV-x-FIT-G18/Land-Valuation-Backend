import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../Common_Pages/database/database.service'

export type User = {
  user_id: string
  first_name: string
  last_name: string
  nic: string
  role: string
  password_hash: string
  must_change_password: boolean
}

// Reads/writes the "users" table (staff + loan applicants).
@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name)

  constructor(private readonly db: DatabaseService) {}

  // Make sure the first-login flag column exists (safe to re-run).
  async onModuleInit() {
    try {
      await this.db.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false`,
      )
    } catch (err) {
      this.logger.error(`Could not ensure must_change_password: ${(err as Error).message}`)
    }
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.db.query('SELECT * FROM users WHERE user_id = $1', [userId])
    return (result.rows[0] as User) ?? null
  }

  // Find a user by their login ID, email, or NIC (for forgot-password).
  async findByIdentifier(identifier: string): Promise<(User & { email?: string }) | null> {
    const v = (identifier ?? '').trim()
    if (!v) return null
    const r = await this.db.query(
      `SELECT * FROM users WHERE user_id = $1 OR email = $1 OR nic = $1 LIMIT 1`,
      [v],
    )
    return (r.rows[0] as User & { email?: string }) ?? null
  }

  // Set a new password hash and clear the first-login flag.
  async setPassword(userId: string, passwordHash: string) {
    await this.db.query(
      `UPDATE users SET password_hash = $1, must_change_password = false WHERE user_id = $2`,
      [passwordHash, userId],
    )
  }

  // Reset the password AND force a change on next login (forgot-password).
  async resetPassword(userId: string, passwordHash: string) {
    await this.db.query(
      `UPDATE users SET password_hash = $1, must_change_password = true WHERE user_id = $2`,
      [passwordHash, userId],
    )
  }

  // The editable profile shown on the Settings page (never the password hash).
  async getProfile(userId: string) {
    const r = await this.db.query(
      `SELECT user_id, role, nic, first_name, last_name, initials, email, phone,
              to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
              province, district, city, postal_code, address
         FROM users WHERE user_id = $1`,
      [userId],
    )
    const u = r.rows[0]
    if (!u) return null
    return {
      userId: u.user_id as string,
      role: u.role as string,
      nic: u.nic as string,
      firstName: u.first_name as string,
      lastName: u.last_name as string,
      initials: u.initials as string,
      email: u.email as string,
      phone: u.phone as string,
      dateOfBirth: (u.date_of_birth as string) ?? '',
      province: u.province as string,
      district: u.district as string,
      city: u.city as string,
      postalCode: u.postal_code as string,
      address: u.address as string,
    }
  }

  // Update the user's personal fields. Identity fields (user_id, role, nic) and
  // the password are intentionally NOT changed here.
  async updateProfile(
    userId: string,
    d: {
      firstName?: string
      lastName?: string
      initials?: string
      email?: string
      phone?: string
      dateOfBirth?: string
      province?: string
      district?: string
      city?: string
      postalCode?: string
      address?: string
    },
  ) {
    await this.db.query(
      `UPDATE users SET
         first_name = $2, last_name = $3, initials = $4, email = $5, phone = $6,
         date_of_birth = $7, province = $8, district = $9, city = $10,
         postal_code = $11, address = $12
       WHERE user_id = $1`,
      [
        userId,
        (d.firstName ?? '').trim(),
        (d.lastName ?? '').trim(),
        (d.initials ?? '').trim(),
        (d.email ?? '').trim(),
        (d.phone ?? '').trim(),
        d.dateOfBirth || null,
        (d.province ?? '').trim(),
        (d.district ?? '').trim(),
        (d.city ?? '').trim(),
        (d.postalCode ?? '').trim(),
        (d.address ?? '').trim(),
      ],
    )
    return this.getProfile(userId)
  }
}
