import { Module } from '@nestjs/common'
import { NearbyController } from './nearby.controller'
import { NearbyService } from './nearby.service'
import { TechnicalOfficerProjectAccessService } from '../shared/technical-officer-project-access.service'

// AiService is provided globally (AiModule); DatabaseService is global too.
@Module({
  controllers: [NearbyController],
  providers: [NearbyService, TechnicalOfficerProjectAccessService],
})
export class NearbyModule {}
