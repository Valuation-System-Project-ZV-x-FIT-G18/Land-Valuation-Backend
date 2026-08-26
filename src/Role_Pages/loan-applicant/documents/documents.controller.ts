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
import { DocumentsService } from './documents.service'
import { SetDocumentStatusDto, UploadDocumentDto } from './dto/documents.dto'
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

@Controller('applicant/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // GET /api/applicant/documents?nic=&projectId=
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('projectId') projectId: string) {
    return { documents: await this.documents.list(user.userId, projectId ?? '') }
  }

  // POST /api/applicant/documents — upload { nic, docType } + file.
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.upload(user.userId, dto.projectId ?? '', dto.docType, file)
  }

  // POST /api/applicant/documents/status
  @Post('status')
  async setStatus(@CurrentUser() user: AuthUser, @Body() dto: SetDocumentStatusDto) {
    return this.documents.setStatus(user.userId, dto.projectId ?? '', dto.docType, dto.status, dto.label ?? '')
  }

  // GET /api/applicant/documents/file?nic=&projectId=&docType=
  @Get('file')
  async file(
    @CurrentUser() user: AuthUser,
    @Query('projectId') projectId: string,
    @Query('docType') docType: string,
    @Res() res: Response,
  ) {
    const f = await this.documents.attachment(user.userId, projectId ?? '', docType ?? '')
    if (!f) { res.status(404).json({ error: 'File not found.' }); return }
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`)
    if (!f.data) { res.status(404).json({ error: 'Object not found in Supabase Storage.' }); return }
    res.setHeader('Content-Type', f.mime || 'application/octet-stream'); res.send(f.data)
  }
}
