import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { DraftService } from './draft.service'

// Technical Officer — "Create Draft": assemble, edit and save the valuation
// report draft for a project.
@Controller('technical-officer/draft')
export class DraftController {
  constructor(private readonly draft: DraftService) {}

  // GET /fill?projectId=... — the template with every #N token filled in.
  @Get('fill')
  async fill(@Query('projectId') projectId: string) {
    return this.draft.fill(projectId ?? '')
  }

  // GET /build?projectId=... — the raw mapped field values (debug / reuse).
  @Get('build')
  async build(@Query('projectId') projectId: string) {
    const res = await this.draft.buildValues(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  // GET ?projectId=... — the previously saved draft (or null).
  @Get()
  async get(@Query('projectId') projectId: string) {
    return { data: await this.draft.get(projectId ?? '') }
  }

  // POST { projectId, data } — save the edited draft.
  @Post()
  async save(@Body() body: { projectId: string; data: Record<string, string> }) {
    return this.draft.save(String(body.projectId ?? ''), body.data ?? {})
  }
}
