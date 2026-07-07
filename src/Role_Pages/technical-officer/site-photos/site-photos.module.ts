import { Module } from '@nestjs/common'
import { SitePhotosController } from './site-photos.controller'
import { SitePhotosService } from './site-photos.service'

@Module({
  controllers: [SitePhotosController],
  providers: [SitePhotosService],
})
export class SitePhotosModule {}
