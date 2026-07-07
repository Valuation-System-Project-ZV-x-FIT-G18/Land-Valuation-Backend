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
import { DocumentsService } from './documents.service'

const uploadDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

@Controller('applicant/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // GET /api/applicant/documents?nic=... — the applicant's uploaded documents.
  @Get()
  async list(@Query('nic') nic: string) {
    return { documents: await this.documents.list(nic ?? '') }
  }

  // POST /api/applicant/documents — upload { nic, docType } + file.
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
  async upload(
    @Body() body: { nic: string; docType: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.upload(body.nic, body.docType, file)
  }

  // POST /api/applicant/documents/status — coordinator sets a document's status.
  @Post('status')
  async setStatus(
    @Body() body: { nic: string; docType: string; status: string; label: string },
  ) {
    return this.documents.setStatus(body.nic, body.docType, body.status, body.label)
  }

  // GET /api/applicant/documents/file?nic=&docType= — download a document.
  @Get('file')
  async file(
    @Query('nic') nic: string,
    @Query('docType') docType: string,
    @Res() res: Response,
  ) {
    const f = await this.documents.attachment(nic ?? '', docType ?? '')
    if (!f) {
      res.status(404).json({ error: 'File not found.' })
      return
    }
    res.download(join(uploadDir, f.filePath), f.fileName)
  }
}
