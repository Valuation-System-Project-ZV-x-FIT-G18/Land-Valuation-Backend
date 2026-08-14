import { Module } from '@nestjs/common'
import { DraftController } from './draft.controller'
import { DraftService } from './draft.service'
import { DocxReportService } from './docx-report.service'

@Module({
  controllers: [DraftController],
  providers: [DraftService, DocxReportService],
})
export class DraftModule {}
