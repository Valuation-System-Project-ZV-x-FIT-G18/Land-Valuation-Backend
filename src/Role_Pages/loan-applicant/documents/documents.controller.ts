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
import { DocumentsService } from './documents.service'
import { SetDocumentStatusDto, UploadDocumentDto } from './dto/documents.dto'

const uploadDir = join(process.cwd(), 'uploads')

@Controller('applicant/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // GET /api/applicant/documents?nic=&projectId=
  @Get()
  async list(@Query('nic') nic: string, @Query('projectId') projectId: string) {
    return { documents: await this.documents.list(nic ?? '', projectId ?? '') }
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
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.upload(dto.nic, dto.projectId ?? '', dto.docType, file)
  }

  // POST /api/applicant/documents/status
  @Post('status')
  async setStatus(@Body() dto: SetDocumentStatusDto) {
    return this.documents.setStatus(dto.nic, dto.projectId ?? '', dto.docType, dto.status, dto.label ?? '')
  }

  // GET /api/applicant/documents/file?nic=&projectId=&docType=
  @Get('file')
  async file(
    @Query('nic') nic: string,
    @Query('projectId') projectId: string,
    @Query('docType') docType: string,
    @Res() res: Response,
  ) {
    const f = await this.documents.attachment(nic ?? '', projectId ?? '', docType ?? '')
    if (!f) { res.status(404).json({ error: 'File not found.' }); return }
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`)
    if (f.data) { res.setHeader('Content-Type', f.mime || 'application/octet-stream'); res.send(f.data); return }
    const legacyPath = join(uploadDir, f.filePath)
    if (!f.filePath || !existsSync(legacyPath)) { res.status(410).json({ error: 'This legacy document is missing. Please upload it again.' }); return }
    res.sendFile(legacyPath)
  }
}
