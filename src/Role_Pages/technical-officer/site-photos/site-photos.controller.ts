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
import { SitePhotosService } from './site-photos.service'

const uploadDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

@Controller('technical-officer/site-photos')
export class SitePhotosController {
  constructor(private readonly photos: SitePhotosService) {}

  // GET /api/technical-officer/site-photos?projectId=...
  @Get()
  async list(@Query('projectId') projectId: string) {
    return { photos: await this.photos.list(projectId ?? '') }
  }

  // POST /api/technical-officer/site-photos — { projectId, toId, photoType } + file
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @Body() body: { projectId: string; toId: string; photoType: string; describe?: string; photoLabel?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.photos.upload(
      body.projectId,
      body.toId,
      body.photoType,
      file,
      body.describe === 'true',
      body.photoLabel ?? '',
    )
  }

  // GET /api/technical-officer/site-photos/file?projectId=&photoType= — view/download.
  @Get('file')
  async file(
    @Query('projectId') projectId: string,
    @Query('photoType') photoType: string,
    @Res() res: Response,
  ) {
    const f = await this.photos.attachment(projectId ?? '', photoType ?? '')
    if (!f) {
      res.status(404).json({ error: 'Photo not found.' })
      return
    }
    res.sendFile(join(uploadDir, f.filePath)) // inline so <img> can display it
  }
}
