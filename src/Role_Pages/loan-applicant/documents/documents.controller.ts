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

<<<<<<< HEAD
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
      res.status(410).json({ error: 'This legacy document is missing. Please upload it again.' })
      return
    }
    res.download(path, file.fileName)
    return
  }
  res.status(404).json({ error: 'File not found.' })
}

=======
>>>>>>> b75f317 (Describe your changes)
@Controller('applicant/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  async list(@Query('nic') nic: string, @Query('projectId') projectId: string) {
    return { documents: await this.documents.list(nic ?? '', projectId ?? '') }
  }

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

  @Post('status')
  async setStatus(@Body() dto: SetDocumentStatusDto) {
    return this.documents.setStatus(dto.nic, dto.projectId ?? '', dto.docType, dto.status, dto.label ?? '')
  }

  @Get('file')
  async file(
    @Query('nic') nic: string,
    @Query('projectId') projectId: string,
    @Query('docType') docType: string,
    @Res() res: Response,
  ) {
    const f = await this.documents.attachment(nic ?? '', projectId ?? '', docType ?? '')
<<<<<<< HEAD
    if (!f) {
      res.status(404).json({ error: 'File not found.' })
      return
    }
    sendFileResponse(res, f)
=======
    if (!f) { res.status(404).json({ error: 'File not found.' }); return }
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`)
    if (!f.data) { res.status(404).json({ error: 'Object not found in Supabase Storage.' }); return }
    res.setHeader('Content-Type', f.mime || 'application/octet-stream'); res.send(f.data)
>>>>>>> b75f317 (Describe your changes)
  }
}
