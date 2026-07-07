import { Module } from '@nestjs/common'
import { ManagerDraftsController } from './manager-drafts.controller'
import { ManagerDraftsService } from './manager-drafts.service'

@Module({
  controllers: [ManagerDraftsController],
  providers: [ManagerDraftsService],
})
export class ManagerDraftsModule {}
