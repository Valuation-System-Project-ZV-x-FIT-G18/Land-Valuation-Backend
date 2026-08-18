import { Module } from '@nestjs/common'
import { ValuerProfileController } from './valuer-profile.controller'
import { ValuerProfileService } from './valuer-profile.service'

@Module({ controllers: [ValuerProfileController], providers: [ValuerProfileService] })
export class ValuerProfileModule {}
