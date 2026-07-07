import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { NearbyService, AnalyseInput } from './nearby.service'

// Technical Officer — "Analyse Nearby Lands": location, comparable evidence
// (from property portals via AI), and the valuation report sections (9–13).
@Controller('technical-officer/nearby')
export class NearbyController {
  constructor(private readonly nearby: NearbyService) {}

  @Get('location')
  async location(@Query('projectId') projectId: string) {
    const res = await this.nearby.location(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  @Get('comparables')
  async comparables(@Query('projectId') projectId: string) {
    return this.nearby.comparables(projectId ?? '')
  }

  @Post('analyse')
  async analyse(@Body() body: { projectId: string; input: AnalyseInput }) {
    return this.nearby.analyse(String(body.projectId ?? ''), body.input ?? {})
  }

  @Get()
  async get(@Query('projectId') projectId: string) {
    return { data: await this.nearby.getAnalysis(projectId ?? '') }
  }

  @Post()
  async save(@Body() body: { projectId: string; data: Record<string, unknown> }) {
    return this.nearby.saveAnalysis(String(body.projectId ?? ''), body.data ?? {})
  }
}
