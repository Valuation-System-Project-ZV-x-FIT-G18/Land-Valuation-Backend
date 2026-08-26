import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import type { Response } from 'express'
import { ReportAccessService } from './report-access.service'
import { PaySlipDto, VerifySlipDto } from './dto/client.dto'
import { CurrentUser } from '../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../Home_Pages/auth/types/auth-user'

@Controller('client')
export class ReportAccessController {
  constructor(private readonly service: ReportAccessService) {}

  // GET /api/client/applicant/projects?nic=...
  @Get('applicant/projects')
  async applicantProjects(@CurrentUser() user: AuthUser) {
    return { projects: await this.service.applicantProjects(user.userId) }
  }

  // POST /api/client/applicant/pay-slip (multipart)
  @Post('applicant/pay-slip')
  @UseInterceptors(
    FileInterceptor('slip', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async paySlip(@CurrentUser() user: AuthUser, @Body() dto: PaySlipDto, @UploadedFile() file?: Express.Multer.File) {
    return this.service.paySlip(user.userId, dto.projectId, file)
  }

  // GET /api/client/pending-slips
  @Get('pending-slips')
  async pendingSlips() {
    return { slips: await this.service.pendingSlips() }
  }

  // POST /api/client/verify-slip { projectId, approve }
  @Post('verify-slip')
  async verifySlip(@Body() dto: VerifySlipDto) {
    return this.service.verifySlip(dto.projectId, dto.approve, dto.reason)
  }

  // GET /api/client/slip?projectId=...
  @Get('slip')
  async slip(@Query('projectId') projectId: string, @Res() res: Response) {
    const file = await this.service.slipFile(projectId ?? '')
    if (!file) { res.status(404).json({ error: 'No slip found.' }); return }
    if (!file.data) { res.status(404).json({ error: 'Object not found in Supabase Storage.' }); return }
    res.setHeader('Content-Type', file.mime || 'application/octet-stream'); res.send(file.data)
  }

  // GET /api/client/bank/projects?bankId=...
  @Get('bank/projects')
  async bankProjects(@CurrentUser() user: AuthUser) {
    return { projects: await this.service.bankProjects(user.userId) }
  }

  // The requesting bank may read only its own paid, finalized report.
  @Get('bank/report')
  async bankReport(@CurrentUser() user: AuthUser, @Query('projectId') projectId: string) {
    return this.service.bankReport(user, projectId ?? '')
  }

  // Authenticated operational overview for Bank and Loan Applicant dashboards.
  @Get('dashboard/projects')
  async dashboardProjects(@CurrentUser() user: AuthUser) {
    return { projects: await this.service.dashboardProjects(user) }
  }

  // GET /api/client/can-view?projectId=...
  @Get('can-view')
  async canView(@Query('projectId') projectId: string) {
    return this.service.canView(projectId ?? '')
  }
}
