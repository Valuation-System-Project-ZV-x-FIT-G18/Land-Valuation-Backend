import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { DescriptionsService } from './descriptions.service'

@Controller('technical-officer/descriptions')
export class DescriptionsController {
  constructor(private readonly descriptions: DescriptionsService) {}

  // GET /sources?projectId=... — the editable source fields per section + photo list.
  @Get('sources')
  async sources(@Query('projectId') projectId: string) {
    const res = await this.descriptions.sources(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  // POST /generate-one { projectId, section, fields } — (re)generate ONE section.
  @Post('generate-one')
  async generateOne(
    @Body() body: { projectId: string; section: string; fields?: Record<string, string> },
  ) {
    return this.descriptions.generateOne(
      String(body.projectId ?? ''),
      String(body.section ?? ''),
      body.fields ?? {},
    )
  }

  // GET /valuation?projectId=... — computed Section 11 valuation figures.
  @Get('valuation')
  async valuation(@Query('projectId') projectId: string) {
    return this.descriptions.valuation(projectId ?? '')
  }

  // GET /evidence?projectId=... — Section 9 evidence pulled from nearby analysis.
  @Get('evidence')
  async evidence(@Query('projectId') projectId: string) {
    return this.descriptions.evidence(projectId ?? '')
  }

  // GET /completed — project IDs that already have saved descriptions.
  @Get('completed')
  async completed() {
    return { projectIds: await this.descriptions.completedProjects() }
  }

  // GET ?projectId=... — the saved descriptions (or null).
  @Get()
  async get(@Query('projectId') projectId: string) {
    return { data: await this.descriptions.get(projectId ?? '') }
  }

  // POST { projectId, data } — save the edited descriptions.
  @Post()
  async save(@Body() body: { projectId: string; data: Record<string, string> }) {
    return this.descriptions.save(body.projectId, body.data)
  }
}
