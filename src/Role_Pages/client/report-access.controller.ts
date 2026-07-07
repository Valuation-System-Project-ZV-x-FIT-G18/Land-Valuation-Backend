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

const uploadDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

// External client report access — loan applicant payments and bank viewing.
@Controller('client')
export class ReportAccessController {
  constructor(private readonly service: ReportAccessService) {}

  // GET /api/client/applicant/projects?nic=... — the applicant's payable reports.
  @Get('applicant/projects')
  async applicantProjects(@Query('nic') nic: string) {
    return { projects: await this.service.applicantProjects(nic ?? '') }
  }

  // POST /api/client/applicant/pay { projectId } — card payment (demo gateway).
  @Post('applicant/pay')
  async pay(@Body() body: { projectId: string }) {
    return this.service.pay(String(body.projectId ?? ''))
  }

  // POST /api/client/applicant/pay-slip (multipart) — manual bank payment: the
  // applicant uploads the deposit slip, which releases the report.
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
  async paySlip(@Body() body: { projectId: string }, @UploadedFile() file?: Express.Multer.File) {
    return this.service.paySlip(String(body.projectId ?? ''), file?.filename ?? '')
  }

  // GET /api/client/pending-slips — slips awaiting coordinator verification.
  @Get('pending-slips')
  async pendingSlips() {
    return { slips: await this.service.pendingSlips() }
  }

  // POST /api/client/verify-slip { projectId, approve } — coordinator decision.
  @Post('verify-slip')
  async verifySlip(@Body() body: { projectId: string; approve: boolean }) {
    return this.service.verifySlip(String(body.projectId ?? ''), !!body.approve)
  }

  // GET /api/client/slip?projectId=... — view the uploaded deposit slip.
  @Get('slip')
  async slip(@Query('projectId') projectId: string, @Res() res: Response) {
    const path = await this.service.slipPath(projectId ?? '')
    if (!path) { res.status(404).json({ error: 'No slip found.' }); return }
    res.sendFile(join(uploadDir, path))
  }

  // GET /api/client/bank/projects?bankId=... — the bank's viewable reports.
  @Get('bank/projects')
  async bankProjects(@Query('bankId') bankId: string) {
    return { projects: await this.service.bankProjects(bankId ?? '') }
  }

  // GET /api/client/can-view?projectId=... — is the report paid & viewable?
  @Get('can-view')
  async canView(@Query('projectId') projectId: string) {
    return this.service.canView(projectId ?? '')
  }
}
