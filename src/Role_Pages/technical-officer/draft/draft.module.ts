//05
import { Module } from '@nestjs/common'
import { DraftController } from './draft.controller'
import { DraftService } from './draft.service'
import { DocxReportService } from './docx-report.service'
import { PdfReportService } from './pdf-report.service'

@Module({
  controllers: [DraftController],
  providers: [DraftService, DocxReportService, PdfReportService],
})
export class DraftModule {}
