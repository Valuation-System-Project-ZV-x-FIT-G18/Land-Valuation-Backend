//03
import { Module } from '@nestjs/common'
import { DescriptionsController } from './descriptions.controller'
import { DescriptionsService } from './descriptions.service'

@Module({
  controllers: [DescriptionsController],
  providers: [DescriptionsService],
})
export class DescriptionsModule {}
