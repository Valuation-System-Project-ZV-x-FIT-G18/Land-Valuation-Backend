import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { ObjectStorageService } from '../storage/object-storage.service'

type Row = Record<string, unknown>

@Injectable()
export class MessagesService implements OnModuleInit {
  private readonly logger = new Logger(MessagesService.name)

  constructor(private readonly db: DatabaseService, private readonly storage: ObjectStorageService) {}

  async onModuleInit() {
    try {
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS messages (
           id           SERIAL PRIMARY KEY,
           sender_id    VARCHAR(20)  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
           recipient_id VARCHAR(20)  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
           body         TEXT         NOT NULL DEFAULT '',
           file_name    VARCHAR(255) NOT NULL DEFAULT '',
           file_path    VARCHAR(255) NOT NULL DEFAULT '',
           file_mime    VARCHAR(100) NOT NULL DEFAULT '',
           file_data    BYTEA,
           object_key   VARCHAR(1024) NOT NULL DEFAULT '',
           read         BOOLEAN      NOT NULL DEFAULT false,
           created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
         )`,
      )
      await this.db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_path VARCHAR(255) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_mime VARCHAR(100) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_data BYTEA`)
      await this.db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS object_key VARCHAR(1024) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE messages ALTER COLUMN body SET DEFAULT ''`)
      await this.db.query(`CREATE INDEX IF NOT EXISTS messages_pair_idx ON messages (sender_id, recipient_id)`)
    } catch (err) {
      this.logger.error(`Messages setup failed: ${(err as Error).message}`)
    }
  }

  private toMessage(m: Row) {
    return {
      id: Number(m.id),
      senderId: m.sender_id as string,
      recipientId: m.recipient_id as string,
      body: m.body as string,
      fileName: (m.file_name as string) ?? '',
      read: m.read as boolean,
      createdAt: m.created_at as string,
    }
  }

  async listUsersByRole(role: string) {
    const r = await this.db.query(
      `SELECT user_id, first_name, last_name FROM users WHERE role = $1
        ORDER BY first_name, last_name`,
      [role],
    )
    return r.rows.map((u) => ({
      userId: u.user_id as string,
      name: `${u.first_name} ${u.last_name}`.trim() || (u.user_id as string),
    }))
  }

  async send(senderId: string, recipientId: string, body: string, file?: Express.Multer.File) {
    const s = (senderId ?? '').trim()
    const rcpt = (recipientId ?? '').trim()
    const b = (body ?? '').trim()
    if (!s || !rcpt) return { ok: false, error: 'Missing fields.' }
    if (!b && !file) return { ok: false, error: 'Type a message or attach a file.' }
    if (file && !file.buffer?.length) {
      return { ok: false, error: 'The file content was not received. Please attach the file again.' }
    }
    if (s === rcpt) return { ok: false, error: 'You cannot message yourself.' }
    const exists = await this.db.query(`SELECT 1 FROM users WHERE user_id = $1`, [rcpt])
    if (!exists.rows[0]) return { ok: false, error: 'Recipient not found.' }

    const stored = file ? await this.storage.store(file, `messages/${s}/${rcpt}`) : { objectKey: '', databaseFallback: null }
    const r = await this.db.query(
      `INSERT INTO messages (sender_id, recipient_id, body, file_name, file_path, file_mime, file_data, object_key)
       VALUES ($1, $2, $3, $4, '', $5, $6, $7)
       RETURNING id, sender_id, recipient_id, body, file_name, read, created_at`,
      [s, rcpt, b, file?.originalname ?? '', file?.mimetype ?? '', stored.databaseFallback ?? file?.buffer ?? null, stored.objectKey],
    )
    return { ok: true, message: this.toMessage(r.rows[0]) }
  }

  async attachment(id: string, userId: string) {
    const n = Number(id)
    if (!Number.isInteger(n)) return null
    const r = await this.db.query(
      `SELECT sender_id, recipient_id, file_name, file_mime, object_key FROM messages WHERE id = $1`,
      [n],
    )
    const m = r.rows[0]
<<<<<<< HEAD
    if (!m || (!m.object_key && !m.file_data && !m.file_path)) return null
    if (m.sender_id !== userId && m.recipient_id !== userId) return null
    const objectData = await this.storage.read(m.object_key as string)
    return {
      fileName: m.file_name as string,
      filePath: (m.file_path as string) || '',
      mime: (m.file_mime as string) || 'application/octet-stream',
      data: objectData ?? (m.file_data as Buffer | null) ?? null,
    }
=======
    if (!m?.object_key) return null
    if (m.sender_id !== userId && m.recipient_id !== userId) return null // not yours
    const objectData = await this.storage.read(m.object_key as string)
    return { fileName: m.file_name as string, mime: m.file_mime as string, data: objectData }
>>>>>>> b75f317 (Describe your changes)
  }

  async conversation(userId: string, otherId: string) {
    const r = await this.db.query(
      `SELECT id, sender_id, recipient_id, body, file_name, read, created_at
         FROM messages
        WHERE (sender_id = $1 AND recipient_id = $2)
           OR (sender_id = $2 AND recipient_id = $1)
        ORDER BY created_at ASC`,
      [userId, otherId],
    )
    await this.db.query(
      `UPDATE messages SET read = true
        WHERE recipient_id = $1 AND sender_id = $2 AND read = false`,
      [userId, otherId],
    )
    return r.rows.map((m) => this.toMessage(m))
  }

  async threads(userId: string) {
    const r = await this.db.query(
      `SELECT id, sender_id, recipient_id, body, file_name, read, created_at
         FROM messages
        WHERE sender_id = $1 OR recipient_id = $1
        ORDER BY created_at DESC`,
      [userId],
    )

    const map = new Map<string, { otherId: string; lastBody: string; lastAt: string; unread: number; name: string; role: string }>()
    for (const m of r.rows) {
      const other = (m.sender_id === userId ? m.recipient_id : m.sender_id) as string
      if (!map.has(other)) {
        const preview = (m.body as string) || (m.file_name ? `File: ${m.file_name}` : '')
        map.set(other, { otherId: other, lastBody: preview, lastAt: m.created_at as string, unread: 0, name: other, role: '' })
      }
      if (m.recipient_id === userId && !m.read) map.get(other)!.unread++
    }

    const ids = [...map.keys()]
    if (ids.length) {
      const names = await this.db.query(
        `SELECT user_id, first_name, last_name, role FROM users WHERE user_id = ANY($1)`,
        [ids],
      )
      for (const n of names.rows) {
        const t = map.get(n.user_id as string)
        if (t) {
          t.name = `${n.first_name} ${n.last_name}`.trim() || (n.user_id as string)
          t.role = n.role as string
        }
      }
    }
    return [...map.values()]
  }
}
