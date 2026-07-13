import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { DescriptionsService } from './descriptions.service'
import { GenerateOneDto, SaveDescriptionsDto } from './dto/descriptions.dto'

@Controller('technical-officer/descriptions')
export class DescriptionsController {
  constructor(private readonly descriptions: DescriptionsService) {}

  // GET /sources?projectId=...
  @Get('sources')
  async sources(@Query('projectId') projectId: string) {
    const res = await this.descriptions.sources(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  // POST /generate-one { projectId, section, fields }
  @Post('generate-one')
  async generateOne(@Body() dto: GenerateOneDto) {
    return this.descriptions.generateOne(dto.projectId, dto.section, dto.fields ?? {})
  }

  // GET /valuation?projectId=...
  @Get('valuation')
  async valuation(@Query('projectId') projectId: string) {
    return this.descriptions.valuation(projectId ?? '')
  }

  // GET /evidence?projectId=...
  @Get('evidence')
  async evidence(@Query('projectId') projectId: string) {
    return this.descriptions.evidence(projectId ?? '')
  }

  // GET /completed
  @Get('completed')
  async completed() {
    return { projectIds: await this.descriptions.completedProjects() }
  }

  // GET ?projectId=...
  @Get()
  async get(@Query('projectId') projectId: string) {
    return { data: await this.descriptions.get(projectId ?? '') }
  }

  // POST { projectId, data }
  @Post()
  async save(@Body() dto: SaveDescriptionsDto) {
    return this.descriptions.save(dto.projectId, dto.data)
  }
}
