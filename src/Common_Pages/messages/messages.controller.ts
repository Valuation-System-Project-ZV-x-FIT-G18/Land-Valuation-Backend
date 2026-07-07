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
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { Response } from 'express'
import { MessagesService } from './messages.service'

const uploadDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  // GET /api/messages/users?role=Coordinator — recipients of a role.
  @Get('users')
  async users(@Query('role') role: string) {
    return { users: await this.messages.listUsersByRole(role ?? '') }
  }

  // GET /api/messages/threads?userId=... — the viewer's conversations.
  @Get('threads')
  async threads(@Query('userId') userId: string) {
    return { threads: await this.messages.threads(userId ?? '') }
  }

  // GET /api/messages/conversation?userId=...&otherId=... — one chat thread.
  @Get('conversation')
  async conversation(@Query('userId') userId: string, @Query('otherId') otherId: string) {
    return { messages: await this.messages.conversation(userId ?? '', otherId ?? '') }
  }

  // POST /api/messages — send { senderId, recipientId, body } with an optional file.
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async send(
    @Body() body: { senderId: string; recipientId: string; body: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.messages.send(body.senderId, body.recipientId, body.body, file)
  }

  // GET /api/messages/attachment?id=..&userId=.. — download a message's file.
  @Get('attachment')
  async attachment(
    @Query('id') id: string,
    @Query('userId') userId: string,
    @Res() res: Response,
  ) {
    const file = await this.messages.attachment(id ?? '', userId ?? '')
    if (!file) {
      res.status(404).json({ error: 'File not found.' })
      return
    }
    res.download(join(uploadDir, file.filePath), file.fileName)
  }
}
