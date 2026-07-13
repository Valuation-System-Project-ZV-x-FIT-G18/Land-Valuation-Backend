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
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { Response } from 'express'
import { ReportAccessService } from './report-access.service'
import { PayDto, PaySlipDto, VerifySlipDto } from './dto/client.dto'

const uploadDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

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
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) =>
          cb(null, `slip-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async paySlip(@Body() dto: PaySlipDto, @UploadedFile() file?: Express.Multer.File) {
    return this.service.paySlip(dto.projectId, file?.filename ?? '')
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
    const path = await this.service.slipPath(projectId ?? '')
    if (!path) { res.status(404).json({ error: 'No slip found.' }); return }
    res.sendFile(join(uploadDir, path))
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
