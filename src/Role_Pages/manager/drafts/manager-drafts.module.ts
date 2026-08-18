import { Module } from '@nestjs/common'
import { ManagerDraftsController } from './manager-drafts.controller'
import { ManagerDraftsService } from './manager-drafts.service'
import { DraftModule } from '../../technical-officer/draft/draft.module'

@Module({
  imports: [DraftModule],
  controllers: [ManagerDraftsController],
  providers: [ManagerDraftsService],
})
export class ManagerDraftsModule {}
