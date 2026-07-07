import { Module } from '@nestjs/common'
import { ReportAccessController } from './report-access.controller'
import { ReportAccessService } from './report-access.service'

@Module({
  controllers: [ReportAccessController],
  providers: [ReportAccessService],
})
export class ReportAccessModule {}
