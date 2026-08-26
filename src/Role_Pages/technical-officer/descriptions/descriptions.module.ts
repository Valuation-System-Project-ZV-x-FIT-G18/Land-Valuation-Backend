//03
import { Module } from '@nestjs/common'
import { DescriptionsController } from './descriptions.controller'
import { DescriptionsService } from './descriptions.service'
import { TechnicalOfficerProjectAccessService } from '../shared/technical-officer-project-access.service'

@Module({
  controllers: [DescriptionsController],
  providers: [DescriptionsService, TechnicalOfficerProjectAccessService],
})
export class DescriptionsModule {}
