import { Controller, Get, Post } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { CurrentUser } from '../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../Home_Pages/auth/types/auth-user'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // GET /api/notifications — always the signed-in user's own notifications.
  // The id comes from the verified token, never from the request, so nobody
  // can read another user's notifications by changing a parameter.
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.userId)
  }

  // POST /api/notifications/read
  @Post('read')
  async read(@CurrentUser() user: AuthUser) {
    await this.notifications.markRead(user.userId)
    return { ok: true }
  }
}
