//03
import { Module } from '@nestjs/common'
import { MappingController } from './mapping.controller'
import { MappingService } from './mapping.service'
import { TechnicalOfficerProjectAccessService } from '../shared/technical-officer-project-access.service'

// DatabaseService is provided globally.
@Module({
  controllers: [MappingController],
  providers: [MappingService, TechnicalOfficerProjectAccessService],
})
export class MappingModule {}
