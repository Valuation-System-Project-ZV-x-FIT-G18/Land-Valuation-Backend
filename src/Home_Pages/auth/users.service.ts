import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../Common_Pages/database/database.service'
import { toStoredPhone, fromStoredPhone } from '../../Common_Pages/validation/patterns'
import { ObjectStorageService } from '../../Common_Pages/storage/object-storage.service'

export type User = {
  user_id: string
  first_name: string
  last_name: string
  nic: string
  role: string
  password_hash: string
  must_change_password: boolean
  photo_path: string
}

// Reads/writes the "users" table (staff + loan applicants).
@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name)

  constructor(private readonly db: DatabaseService, private readonly storage: ObjectStorageService) {}

  // Make sure the first-login flag column exists (safe to re-run).
  async onModuleInit() {
    try {
      await this.db.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false`,
      )
      await this.db.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255) NOT NULL DEFAULT ''`,
      )
      // The profile picture itself lives in the database (not on disk):
      // photo_data holds the raw bytes, photo_mime its content type. photo_path
      // is repurposed as a cache-busting version token (still just a string).
      await this.db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_data BYTEA`)
      await this.db.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_mime VARCHAR(100) NOT NULL DEFAULT ''`,
      )
      await this.db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_object_key VARCHAR(1024) NOT NULL DEFAULT ''`)
    } catch (err) {
      this.logger.error(`Could not ensure profile columns: ${(err as Error).message}`)
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
              province, district, city, postal_code, address, photo_path
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
      phone: fromStoredPhone(u.phone as string),
      dateOfBirth: (u.date_of_birth as string) ?? '',
      province: u.province as string,
      district: u.district as string,
      city: u.city as string,
      postalCode: u.postal_code as string,
      address: u.address as string,
      photoPath: (u.photo_path as string) ?? '',
    }
  }

  // Save a newly-uploaded profile picture's bytes straight into the database.
  // `token` is just a cache-busting version string returned to the frontend
  // (it has no meaning on disk — there is no file anymore).
  async setPhoto(userId: string, file: Express.Multer.File, token: string) {
    const stored = await this.storage.store(file, `avatars/${userId}`)
    const result = await this.db.query(
      `UPDATE users
          SET photo_data = $1, photo_mime = $2, photo_path = $3, photo_object_key = $4
        WHERE user_id = $5
      RETURNING octet_length(photo_data) AS stored_bytes`,
      [stored.databaseFallback, file.mimetype, token, stored.objectKey, userId],
    )

    if (result.rowCount !== 1) {
      throw new NotFoundException('The user account was not found.')
    }

    // Do not report a successful upload unless PostgreSQL confirms that the
    // complete payload was written to the BYTEA column.
    const storedBytes = Number(result.rows[0]?.stored_bytes ?? 0)
    if (!stored.objectKey && storedBytes !== file.size) {
      throw new Error('The profile picture was not stored completely.')
    }
  }

  // The stored profile-picture bytes + content type, for serving it back.
  async getPhoto(userId: string): Promise<{ data: Buffer; mime: string } | null> {
    const r = await this.db.query(`SELECT photo_data, photo_mime, photo_object_key FROM users WHERE user_id = $1`, [
      userId,
    ])
    const row = r.rows[0]
    if (!row?.photo_object_key && !row?.photo_data) return null
    const objectData = await this.storage.read(row.photo_object_key as string)
    return { data: objectData ?? row.photo_data as Buffer, mime: (row.photo_mime as string) || 'image/jpeg' }
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
        toStoredPhone(d.phone),
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
