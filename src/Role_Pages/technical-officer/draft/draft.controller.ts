import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { DraftService } from './draft.service'
import { SaveDraftDto } from './dto/save-draft.dto'

@Controller('technical-officer/draft')
export class DraftController {
  constructor(private readonly draft: DraftService) {}

  // GET /fill?projectId=...
  @Get('fill')
  async fill(@Query('projectId') projectId: string) {
    return this.draft.fill(projectId ?? '')
  }

  // GET /build?projectId=...
  @Get('build')
  async build(@Query('projectId') projectId: string) {
    const res = await this.draft.buildValues(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  // GET ?projectId=...
  @Get()
  async get(@Query('projectId') projectId: string) {
    return { data: await this.draft.get(projectId ?? '') }
  }

  // POST { projectId, data }
  @Post()
  async save(@Body() dto: SaveDraftDto) {
    return this.draft.save(dto.projectId, dto.data)
  }
}
