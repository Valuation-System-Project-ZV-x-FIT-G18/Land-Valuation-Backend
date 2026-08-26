import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../Common_Pages/database/database.service'
import { MailService } from '../../Common_Pages/mail/mail.service'
import { CreateContactDto } from './dto/create-contact.dto'
import { toStoredPhone } from '../../Common_Pages/validation/patterns'
import { NotificationsService } from '../../Common_Pages/notifications/notifications.service'

// Business logic for contact messages (the "service" layer).
@Injectable()
export class ContactService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateContactDto): Promise<void> {
    await this.db.query(
      `INSERT INTO contact_messages (name, email, phone, message)
       VALUES ($1, $2, $3, $4)`,
      [
        dto.name.trim(),
        dto.email.trim(),
        toStoredPhone(dto.phone), // store the full number
        dto.message.trim(),
      ],
    )
    await this.notifications.createForRole(
      'Coordinator',
      `New website message from ${dto.name.trim()} (${dto.email.trim()}).`,
    )
    // Auto-acknowledge the sender (fire-and-forget; never blocks the response).
    void this.mail.sendAcknowledgement(dto.email.trim(), dto.name, 'message')
  }

  // All contact messages from the public website (newest first).
  async list() {
    const r = await this.db.query(
      `SELECT id, name, email, phone, message, status, resolved_at, created_at
         FROM contact_messages ORDER BY created_at DESC`,
    )
    return r.rows.map((row) => ({
      id: Number(row.id),
      name: row.name as string,
      email: row.email as string,
      phone: row.phone as string,
      message: row.message as string,
      status: row.status as 'Open' | 'Resolved',
      resolvedAt: row.resolved_at as string | null,
      createdAt: row.created_at as string,
    }))
  }

  async updateStatus(id: number, status: string) {
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('Invalid message id.')
    if (!['Open', 'Resolved'].includes(status)) throw new BadRequestException('Status must be Open or Resolved.')
    // The resolved flag is its own parameter on purpose. Reusing $2 both as the
    // stored varchar and inside a text comparison makes Postgres deduce two
    // different types for one parameter and fail with 42P08.
    const result = await this.db.query(
      `UPDATE contact_messages
          SET status = $2,
              resolved_at = CASE WHEN $3 THEN now() ELSE NULL END
        WHERE id = $1
        RETURNING id, status, resolved_at`,
      [id, status, status === 'Resolved'],
    )
    if (!result.rows[0]) throw new NotFoundException('Message not found.')
    return {
      id: Number(result.rows[0].id),
      status: result.rows[0].status as 'Open' | 'Resolved',
      resolvedAt: result.rows[0].resolved_at as string | null,
    }
  }
}
