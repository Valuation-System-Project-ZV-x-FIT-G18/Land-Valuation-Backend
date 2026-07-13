import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { MarkReadDto } from './dto/mark-read.dto'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // GET /api/notifications?userId=...
  @Get()
  async list(@Query('userId') userId: string) {
    return this.notifications.list(userId ?? '')
  }

  // POST /api/notifications/read { userId }
  @Post('read')
  async read(@Body() dto: MarkReadDto) {
    await this.notifications.markRead(dto.userId)
    return { ok: true }
  }
}
