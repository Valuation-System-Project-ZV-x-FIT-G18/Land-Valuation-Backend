import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

// In-site notifications shown on the bell icon in the top bar.
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    try {
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS notifications (
           id         SERIAL PRIMARY KEY,
           user_id    VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
           message    TEXT        NOT NULL,
           read       BOOLEAN     NOT NULL DEFAULT false,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      )
      await this.db.query(
        `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id)`,
      )
    } catch (err) {
      this.logger.error(`Notifications setup failed: ${(err as Error).message}`)
    }
  }

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
}
