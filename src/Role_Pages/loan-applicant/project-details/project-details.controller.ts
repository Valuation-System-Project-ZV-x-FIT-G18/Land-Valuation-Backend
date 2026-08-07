import { Body, Controller, Get, Put, Query } from '@nestjs/common'
import { ProjectDetailsService } from './project-details.service'
import { SaveProjectDetailsDto } from './dto/project-details.dto'

@Controller('applicant/project-details')
export class ProjectDetailsController {
  constructor(private readonly projectDetails: ProjectDetailsService) {}

  // GET /api/applicant/project-details?nic=... — the applicant's saved draft
  // (used both by the applicant's Fill Form page and the coordinator's
  // Create Project page, to auto-fill from it).
  @Get()
  async get(@Query('nic') nic: string) {
    return { form: await this.projectDetails.get(nic ?? '') }
  }

  // PUT /api/applicant/project-details — the applicant saves/updates their draft.
  @Put()
  async save(@Body() dto: SaveProjectDetailsDto) {
    return this.projectDetails.save(dto.nic, dto.data)
  }
}
