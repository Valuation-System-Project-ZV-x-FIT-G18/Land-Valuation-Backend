//04
import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { DraftService } from './draft.service'
import { DocxReportService } from './docx-report.service'
import { SaveDraftDto } from './dto/save-draft.dto'
import { PdfReportService } from './pdf-report.service'
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

@Controller('technical-officer/draft')
export class DraftController {
  constructor(private readonly draft: DraftService, private readonly docx: DocxReportService, private readonly pdf: PdfReportService) {}

  // GET /build?projectId=...
  @Get('build')
  async build(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.draft.assertAssigned(projectId ?? '', user)
    const res = await this.draft.buildValues(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  // GET /word?projectId=... — editable DOCX generated from the canonical template.
  @Get('word')
  async word(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const id = (projectId ?? '').trim()
    await this.draft.assertAssigned(id, user)
    const file = await this.docx.generate(id)
    if (!file) { res.status(404).json({ error: 'Project not found.' }); return }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="Valuation-Report-${id}.docx"`)
    res.send(file)
  }

  @Get('pdf')
  async pdfReport(
    @Query('projectId') projectId: string,
    @Query('type') type: string,
    @CurrentUser() user: AuthUser,
    @Headers('authorization') authorization: string,
    @Res() res: Response,
  ) {
    if (type !== 'draft' && type !== 'final') throw new BadRequestException('PDF type must be draft or final.')
    const id = (projectId ?? '').trim()
    const file = await this.pdf.generate(id, type, user, authorization ?? '')
    const filename = type === 'draft' ? `Draft-Report-${id}.pdf` : `Final-Valuation-Report-${id}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(file)
  }

  // GET ?projectId=...
  @Get()
  async get(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.draft.assertAssigned(projectId ?? '', user)
    return { data: await this.draft.get(projectId ?? '') }
  }

  // POST { projectId, data }
  @Post()
  async save(@Body() dto: SaveDraftDto, @CurrentUser() user: AuthUser) {
    return this.draft.save(dto.projectId, dto.data, user)
  }

  @Get('history')
  async history(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.draft.assertAssigned(projectId ?? '', user)
    return { versions: await this.draft.history(projectId ?? '') }
  }

  @Post('autosave')
  async autosave(@Body() dto: SaveDraftDto, @CurrentUser() user: AuthUser) {
    return this.draft.autosave(dto.projectId, dto.data, user)
  }
}
