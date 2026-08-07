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
import { join } from 'path'
import { existsSync } from 'fs'
import type { Response } from 'express'
import { ReportAccessService } from './report-access.service'
import { PayDto, PaySlipDto, VerifySlipDto } from './dto/client.dto'

const uploadDir = join(process.cwd(), 'uploads')

@Controller('client')
export class ReportAccessController {
  constructor(private readonly service: ReportAccessService) {}

  // GET /api/client/applicant/projects?nic=...
  @Get('applicant/projects')
  async applicantProjects(@Query('nic') nic: string) {
    return { projects: await this.service.applicantProjects(nic ?? '') }
  }

  // POST /api/client/applicant/pay { projectId }
  @Post('applicant/pay')
  async pay(@Body() dto: PayDto) {
    return this.service.pay(dto.projectId)
  }

  // POST /api/client/applicant/pay-slip (multipart)
  @Post('applicant/pay-slip')
  @UseInterceptors(
    FileInterceptor('slip', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async paySlip(@Body() dto: PaySlipDto, @UploadedFile() file?: Express.Multer.File) {
    return this.service.paySlip(dto.projectId, file)
  }

  // GET /api/client/pending-slips
  @Get('pending-slips')
  async pendingSlips() {
    return { slips: await this.service.pendingSlips() }
  }

  // POST /api/client/verify-slip { projectId, approve }
  @Post('verify-slip')
  async verifySlip(@Body() dto: VerifySlipDto) {
    return this.service.verifySlip(dto.projectId, dto.approve)
  }

  // GET /api/client/slip?projectId=...
  @Get('slip')
  async slip(@Query('projectId') projectId: string, @Res() res: Response) {
    const file = await this.service.slipFile(projectId ?? '')
    if (!file) { res.status(404).json({ error: 'No slip found.' }); return }
    if (file.data) { res.setHeader('Content-Type', file.mime || 'application/octet-stream'); res.send(file.data); return }
    const legacyPath = join(uploadDir, file.path)
    if (!file.path || !existsSync(legacyPath)) { res.status(410).json({ error: 'This legacy payment slip is missing. Please upload it again.' }); return }
    res.sendFile(legacyPath)
  }

  // GET /api/client/bank/projects?bankId=...
  @Get('bank/projects')
  async bankProjects(@Query('bankId') bankId: string) {
    return { projects: await this.service.bankProjects(bankId ?? '') }
  }

  // GET /api/client/can-view?projectId=...
  @Get('can-view')
  async canView(@Query('projectId') projectId: string) {
    return this.service.canView(projectId ?? '')
  }
}
