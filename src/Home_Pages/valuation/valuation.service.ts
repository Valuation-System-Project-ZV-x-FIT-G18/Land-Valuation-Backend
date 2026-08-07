import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../Common_Pages/database/database.service'
import { MailService } from '../../Common_Pages/mail/mail.service'
import { CreateValuationDto } from './dto/create-valuation.dto'
import { toStoredPhone } from '../../Common_Pages/validation/patterns'
import { NotificationsService } from '../../Common_Pages/notifications/notifications.service'

// Business logic for valuation requests.
@Injectable()
export class ValuationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateValuationDto): Promise<void> {
    await this.db.query(
      `INSERT INTO valuation_requests (name, phone, email, nic, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        dto.name.trim(),
        toStoredPhone(dto.phone),
        dto.email.trim(),
        dto.nic.trim().toUpperCase(),
        dto.message.trim(),
      ],
    )
    await this.notifications.createForRole(
      'Coordinator',
      `New valuation request from ${dto.name.trim()} (NIC ${dto.nic.trim().toUpperCase()}).`,
    )
    // Auto-acknowledge the requester (fire-and-forget; never blocks the response).
    void this.mail.sendAcknowledgement(dto.email.trim(), dto.name, 'valuation request')
  }

  // All valuation requests from the public website (newest first).
  async list() {
    const r = await this.db.query(
      `SELECT id, name, phone, email, nic, message, created_at
         FROM valuation_requests ORDER BY created_at DESC`,
    )
    return r.rows.map((row) => ({
      id: Number(row.id),
      name: row.name as string,
      phone: row.phone as string,
      email: row.email as string,
      nic: row.nic as string,
      message: row.message as string,
      createdAt: row.created_at as string,
    }))
  }
}
