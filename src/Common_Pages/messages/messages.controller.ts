//08
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import type { Response } from 'express'
import { MessagesService } from './messages.service'
import { SendMessageDto } from './dto/send-message.dto'
import { CurrentUser } from '../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../Home_Pages/auth/types/auth-user'

@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  // GET /api/messages/users?search=perera
  @Get('users')
  async users(@CurrentUser() user: AuthUser, @Query('search') search: string) {
    return { users: await this.messages.searchUsers(user.userId, search ?? '') }
  }

  // GET /api/messages/threads
  @Get('threads')
  async threads(@CurrentUser() user: AuthUser) {
    return { threads: await this.messages.threads(user.userId) }
  }

  // GET /api/messages/conversation?otherId=...
  @Get('conversation')
  async conversation(@CurrentUser() user: AuthUser, @Query('otherId') otherId: string) {
    return { messages: await this.messages.conversation(user.userId, otherId ?? '') }
  }

  // POST /api/messages — send a message with an optional file.
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async send(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.messages.send(user.userId, dto.recipientId, dto.body ?? '', file)
  }

  // GET /api/messages/attachment?id=..
  @Get('attachment')
  async attachment(
    @CurrentUser() user: AuthUser,
    @Query('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.messages.attachment(id ?? '', user.userId)
    if (!file) { res.status(404).json({ error: 'File not found.' }); return }
    if (!file.data) { res.status(404).json({ error: 'Object not found in Supabase Storage.' }); return }
    res.setHeader('Content-Type', file.mime || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
    res.send(file.data)
  }
}
