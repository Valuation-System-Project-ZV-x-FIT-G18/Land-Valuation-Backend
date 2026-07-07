import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // GET /api/notifications?userId=... — list + unread count.
  @Get()
  async list(@Query('userId') userId: string) {
    return this.notifications.list(userId ?? '')
  }

  // POST /api/notifications/read { userId } — mark all as read.
  @Post('read')
  async read(@Body() body: { userId: string }) {
    await this.notifications.markRead(body.userId ?? '')
    return { ok: true }
  }
}
