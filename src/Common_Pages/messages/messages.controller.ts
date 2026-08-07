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
import { join } from 'path'
import { existsSync } from 'fs'
import type { Response } from 'express'
import { MessagesService } from './messages.service'
import { SendMessageDto } from './dto/send-message.dto'

const uploadDir = join(process.cwd(), 'uploads')

function sendFileResponse(
  res: Response,
  file: { fileName: string; filePath?: string; mime?: string; data?: Buffer | null },
) {
  if (file.data) {
    res.setHeader('Content-Type', file.mime || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
    res.send(file.data)
    return
  }
  if (file.filePath) {
    const path = join(uploadDir, file.filePath)
    if (!existsSync(path)) {
      res.status(410).json({ error: 'This legacy attachment is missing. Please upload it again.' })
      return
    }
    res.download(path, file.fileName)
    return
  }
  res.status(404).json({ error: 'File not found.' })
}

@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('users')
  async users(@Query('role') role: string) {
    return { users: await this.messages.listUsersByRole(role ?? '') }
  }

  @Get('threads')
  async threads(@Query('userId') userId: string) {
    return { threads: await this.messages.threads(userId ?? '') }
  }

  @Get('conversation')
  async conversation(@Query('userId') userId: string, @Query('otherId') otherId: string) {
    return { messages: await this.messages.conversation(userId ?? '', otherId ?? '') }
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async send(
    @Body() dto: SendMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.messages.send(dto.senderId, dto.recipientId, dto.body ?? '', file)
  }

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
    sendFileResponse(res, file)
  }
}
