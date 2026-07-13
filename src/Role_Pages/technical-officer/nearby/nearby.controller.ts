import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { NearbyService, AnalyseInput } from './nearby.service'
import { AnalyseDto, SaveAnalysisDto } from './dto/nearby.dto'

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
  async analyse(@Body() dto: AnalyseDto) {
    return this.nearby.analyse(dto.projectId, dto.input as AnalyseInput)
  }

  @Get()
  async get(@Query('projectId') projectId: string) {
    return { data: await this.nearby.getAnalysis(projectId ?? '') }
  }

  @Post()
  async save(@Body() dto: SaveAnalysisDto) {
    return this.nearby.saveAnalysis(dto.projectId, dto.data)
  }
}
