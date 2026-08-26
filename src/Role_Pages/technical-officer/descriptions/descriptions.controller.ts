//02
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { DescriptionsService } from './descriptions.service'
import { GenerateOneDto, SaveDescriptionsDto } from './dto/descriptions.dto'
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'
import { TechnicalOfficerProjectAccessService } from '../shared/technical-officer-project-access.service'

@Controller('technical-officer/descriptions')
export class DescriptionsController {
  constructor(private readonly descriptions: DescriptionsService, private readonly access: TechnicalOfficerProjectAccessService) {}

  // GET /sources?projectId=...
  @Get('sources')
  async sources(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(projectId ?? '', user)
    const res = await this.descriptions.sources(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  // POST /generate-one { projectId, section, fields }
  // POST /api/technical-officer/descriptions/generate-all  { projectId }
  // Writes every section in one AI request and saves them, so the report is
  // populated without the officer regenerating each section by hand.
  @Post('generate-all')
  async generateAll(@Body() dto: { projectId?: string }, @CurrentUser() user: AuthUser) {
    const projectId = (dto?.projectId ?? '').trim()
    await this.access.assertAssigned(projectId, user)
    return this.descriptions.generateAll(projectId)
  }

  @Post('generate-one')
  async generateOne(@Body() dto: GenerateOneDto, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(dto.projectId, user)
    return this.descriptions.generateOne(dto.projectId, dto.section, dto.fields ?? {})
  }

  // GET /valuation?projectId=...
  @Get('valuation')
  async valuation(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(projectId ?? '', user)
    return this.descriptions.valuation(projectId ?? '')
  }

  // GET /evidence?projectId=...
  @Get('evidence')
  async evidence(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(projectId ?? '', user)
    return this.descriptions.evidence(projectId ?? '')
  }

  // GET /completed
  @Get('completed')
  async completed(@CurrentUser() user: AuthUser) {
    if (user.role !== 'Technical Officer') return { projectIds: [] }
    return { projectIds: await this.descriptions.completedProjects(user.userId) }
  }

  // GET ?projectId=...
  @Get()
  async get(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(projectId ?? '', user)
    return { data: await this.descriptions.get(projectId ?? '') }
  }

  // POST { projectId, data }
  @Post()
  async save(@Body() dto: SaveDescriptionsDto, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(dto.projectId, user)
    return this.descriptions.save(dto.projectId, dto.data)
  }
}
