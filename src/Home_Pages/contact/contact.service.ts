import { Injectable } from '@nestjs/common'
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
      `SELECT id, name, email, phone, message, created_at
         FROM contact_messages ORDER BY created_at DESC`,
    )
    return r.rows.map((row) => ({
      id: Number(row.id),
      name: row.name as string,
      email: row.email as string,
      phone: row.phone as string,
      message: row.message as string,
      createdAt: row.created_at as string,
    }))
  }
}
