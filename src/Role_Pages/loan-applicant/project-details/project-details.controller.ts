import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ProjectDetailsService } from './project-details.service'
import { CreateProjectDetailsDto, UpdateProjectDetailsDto } from './dto/project-details.dto'

@Controller('applicant/project-details')
export class ProjectDetailsController {
  constructor(private readonly projectDetails: ProjectDetailsService) {}

  // GET /api/applicant/project-details?nic=... — all of this applicant's
  // drafts (used by their own Fill Form list and the coordinator's picker).
  @Get()
  async list(@Query('nic') nic: string) {
    return { drafts: await this.projectDetails.list(nic ?? '') }
  }

  // POST /api/applicant/project-details — save a new draft.
  @Post()
  async create(@Body() dto: CreateProjectDetailsDto) {
    return this.projectDetails.create(dto.nic, dto.label ?? '', dto.data)
  }

  // PUT /api/applicant/project-details/:id — update one of the applicant's own drafts.
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDetailsDto) {
    return this.projectDetails.update(Number(id), dto.nic, dto.label ?? '', dto.data)
  }

  // DELETE /api/applicant/project-details/:id?nic=...
  @Delete(':id')
  async remove(@Param('id') id: string, @Query('nic') nic: string) {
    return this.projectDetails.remove(Number(id), nic ?? '')
  }

  // POST /api/applicant/project-details/:id/use — the coordinator calls this
  // once a project has actually been created from the draft, so it isn't
  // silently reused for a later, unrelated project.
  @Post(':id/use')
  async markUsed(@Param('id') id: string) {
    return this.projectDetails.markUsed(Number(id))
  }
}
