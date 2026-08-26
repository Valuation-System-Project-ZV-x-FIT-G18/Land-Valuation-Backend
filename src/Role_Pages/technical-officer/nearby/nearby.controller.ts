import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { NearbyService, AnalyseInput } from './nearby.service'
import { AnalyseDto, SaveAnalysisDto } from './dto/nearby.dto'
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'
import { TechnicalOfficerProjectAccessService } from '../shared/technical-officer-project-access.service'

@Controller('technical-officer/nearby')
export class NearbyController {
  constructor(private readonly nearby: NearbyService, private readonly access: TechnicalOfficerProjectAccessService) {}

  @Get('location')
  async location(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(projectId ?? '', user)
    const res = await this.nearby.location(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  @Get('comparables')
  async comparables(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(projectId ?? '', user)
    return this.nearby.comparables(projectId ?? '')
  }

  @Post('analyse')
  async analyse(@Body() dto: AnalyseDto, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(dto.projectId, user)
    return this.nearby.analyse(dto.projectId, dto.input as AnalyseInput)
  }

  @Get()
  async get(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(projectId ?? '', user)
    return { data: await this.nearby.getAnalysis(projectId ?? '') }
  }

  @Post()
  async save(@Body() dto: SaveAnalysisDto, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(dto.projectId, user)
    return this.nearby.saveAnalysis(dto.projectId, dto.data)
  }
}
