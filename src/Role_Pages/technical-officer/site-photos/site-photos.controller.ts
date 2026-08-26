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
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

@Controller('technical-officer/site-photos')
export class SitePhotosController {
  constructor(private readonly photos: SitePhotosService) {}

  // GET /api/technical-officer/site-photos?projectId=...
  @Get()
  async list(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.photos.assertReadable(projectId ?? '', user)
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
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.photos.assertEditable(dto.projectId, user)
    return this.photos.upload(
      dto.projectId, user.userId, dto.photoType,
      file, dto.describe === 'true', dto.photoLabel ?? '',
    )
  }

  // GET /api/technical-officer/site-photos/file?projectId=&photoType=
  @Get('file')
  async file(
    @Query('projectId') projectId: string,
    @Query('photoType') photoType: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    await this.photos.assertReadable(projectId ?? '', user)
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
