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
import { SitePhotosService } from './site-photos.service'
import { UploadSitePhotoDto } from './dto/upload-photo.dto'

@Controller('technical-officer/site-photos')
export class SitePhotosController {
  constructor(private readonly photos: SitePhotosService) {}

  // GET /api/technical-officer/site-photos?projectId=...
  @Get()
  async list(@Query('projectId') projectId: string) {
    return { photos: await this.photos.list(projectId ?? '') }
  }

  // POST /api/technical-officer/site-photos
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @Body() dto: UploadSitePhotoDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.photos.upload(
      dto.projectId, dto.toId, dto.photoType,
      file, dto.describe === 'true', dto.photoLabel ?? '',
    )
  }

  // GET /api/technical-officer/site-photos/file?projectId=&photoType=
  @Get('file')
  async file(
    @Query('projectId') projectId: string,
    @Query('photoType') photoType: string,
    @Res() res: Response,
  ) {
    const f = await this.photos.attachment(projectId ?? '', photoType ?? '')
    if (!f) { res.status(404).json({ error: 'Photo not found.' }); return }
    if (!f.data) {
      res.status(410).json({ error: 'This legacy photo is missing. Please upload it again.' })
      return
    }
    res.set('Content-Type', f.mime)
    res.set('Content-Disposition', `inline; filename="${f.fileName.replace(/"/g, '')}"`)
    res.send(f.data)
  }
}
