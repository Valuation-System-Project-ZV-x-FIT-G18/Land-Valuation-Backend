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
import { ValuationsService } from './valuations.service'
import { CreateValuationRequestDto } from './dto/create-valuation-request.dto'
import { AssignOfficerDto } from './dto/assign-officer.dto'
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

@Controller('coordinator/valuations')
export class ValuationsController {
  constructor(private readonly valuations: ValuationsService) {}

  // POST /api/coordinator/valuations  (multipart/form-data)
  @Post()
  @UseInterceptors(
    FileInterceptor('bankRequestLetter', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async create(
    @Body() dto: CreateValuationRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const { rowId, valuationId } = await this.valuations.create(dto, file)
    return { ok: true, rowId, valuationId }
  }

  // GET /api/coordinator/valuations/by-project?projectId=pro001
  @Get('by-project')
  async byProject(@CurrentUser() user: AuthUser, @Query('projectId') projectId: string) {
    await this.valuations.assertProjectAccess(user, projectId ?? '')
    const valuations = await this.valuations.listByProject(projectId ?? '')
    return { valuations }
  }

  // GET /api/coordinator/valuations/by-nic?nic=<applicant NIC>
  @Get('by-nic')
  async byNic(@Query('nic') nic: string) {
    const valuations = await this.valuations.listByNic(nic ?? '')
    return { valuations }
  }

  // GET /api/coordinator/valuations/details?id=<row id>
  @Get('details')
  async details(@Query('id') id: string) {
    const details = await this.valuations.details(id ?? '')
    return details ?? { error: 'Valuation not found.' }
  }

  // GET /api/coordinator/valuations/file?id=<row id>
  @Get('file')
  async file(@Query('id') id: string, @Res() res: Response) {
    const file = await this.valuations.requestLetter(id ?? '')
    if (!file) { res.status(404).json({ error: 'File not found.' }); return }
    if (!file.data) { res.status(404).json({ error: 'Object not found in Supabase Storage.' }); return }
    res.setHeader('Content-Type', file.mime || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
    res.send(file.data)
  }

  // GET /api/coordinator/valuations/status?id=<surrogate row id>
  @Get('status')
  async status(@CurrentUser() user: AuthUser, @Query('id') id: string) {
    await this.valuations.assertRowAccess(user, id ?? '')
    const status = await this.valuations.getStatus(id ?? '')
    return { found: !!status, status: status ?? undefined }
  }

  // GET /api/coordinator/valuations/timeline?id=<surrogate row id>
  @Get('timeline')
  async timeline(@CurrentUser() user: AuthUser, @Query('id') id: string) {
    await this.valuations.assertRowAccess(user, id ?? '')
    const res = await this.valuations.timeline(id ?? '')
    return res ?? { error: 'Valuation not found.' }
  }

  // GET /api/coordinator/valuations/project-timeline?projectId=...
  @Get('project-timeline')
  async projectTimeline(@CurrentUser() user: AuthUser, @Query('projectId') projectId: string) {
    await this.valuations.assertProjectAccess(user, projectId ?? '')
    const res = await this.valuations.projectTimeline(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  // GET /api/coordinator/valuations/technical-officers
  @Get('technical-officers')
  async technicalOfficers() {
    const officers = await this.valuations.listTechnicalOfficers()
    return { officers }
  }

  // POST /api/coordinator/valuations/assign  { rowId, technicalOfficerId }
  @Post('assign')
  async assign(@Body() dto: AssignOfficerDto) {
    return this.valuations.assignTechnicalOfficer(dto.rowId, dto.technicalOfficerId)
  }
}
