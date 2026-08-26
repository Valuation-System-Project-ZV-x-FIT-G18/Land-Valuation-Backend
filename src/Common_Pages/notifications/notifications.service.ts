import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

// In-site notifications shown on the bell icon in the top bar.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(private readonly db: DatabaseService) {}



  // Add a notification for a user. Never throws (must not fail its caller).
  async create(userId: string, message: string) {
    try {
      await this.db.query(
        `INSERT INTO notifications (user_id, message) VALUES ($1, $2)`,
        [userId.trim(), message],
      )
    } catch (err) {
      this.logger.error(`Could not create notification: ${(err as Error).message}`)
    }
  }

  // Notify every account with a role (for shared work queues such as the
  // coordinator website inbox or manager review queues).
  async createForRole(role: string, message: string) {
    try {
      const r = await this.db.query(`SELECT user_id FROM users WHERE role = $1`, [role])
      for (const row of r.rows) {
        await this.create(row.user_id as string, message)
      }
    } catch (err) {
      this.logger.error(`Could not notify role ${role}: ${(err as Error).message}`)
    }
  }

  // A user's recent notifications plus the unread count.
  async list(userId: string) {
    const r = await this.db.query(
      `SELECT id, message, read, created_at
         FROM notifications WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 50`,
      [userId],
    )
    const notifications = r.rows.map((n) => ({
      id: Number(n.id),
      message: n.message as string,
      read: n.read as boolean,
      createdAt: n.created_at as string,
    }))
    return { notifications, unread: notifications.filter((n) => !n.read).length }
  }

  async markRead(userId: string) {
    await this.db.query(
      `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
      [userId],
    )
  }

  // Resolve a requesting bank's login (its user_id is the branch code) from an
  // email address, e.g. the `bank_email` stored on a project. Used so a project
  // milestone can also notify the bank in-system, not just by email. Returns
  // null when the address isn't tied to a registered Bank login.
  async resolveBankUserId(email: string): Promise<string | null> {
    const e = (email ?? '').trim()
    if (!e) return null
    try {
      const r = await this.db.query(
        `SELECT user_id FROM users WHERE role = 'Bank' AND email = $1 LIMIT 1`,
        [e],
      )
      return (r.rows[0]?.user_id as string) ?? null
    } catch (err) {
      this.logger.error(`Could not resolve bank login: ${(err as Error).message}`)
      return null
    }
  }
}
