import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApplicantsService } from './applicants.service'
import { RegisterApplicantDto } from './dto/register-applicant.dto'
import { UpdateApplicantDto } from './dto/update-applicant.dto'

// Loan applicant lookup + registration for the coordinator's Create Project flow.
@Controller('coordinator/applicants')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  // GET /api/coordinator/applicants/search?nic=...
  @Get('search')
  async search(@Query('nic') nic: string) {
    const applicant = await this.applicantsService.findByNic(nic ?? '')
    return { found: !!applicant, applicant: applicant ?? undefined }
  }

  // GET /api/coordinator/applicants/by-project?projectId=...
  @Get('by-project')
  async byProject(@Query('projectId') projectId: string) {
    const applicant = await this.applicantsService.findByProjectId(projectId ?? '')
    return { found: !!applicant, applicant: applicant ?? undefined }
  }

  // POST /api/coordinator/applicants/register
  @Post('register')
  async register(@Body() dto: RegisterApplicantDto) {
    const applicant = await this.applicantsService.register(dto)
    return { ok: true, applicant }
  }

  // PATCH /api/coordinator/applicants/:nic — correct an existing applicant's details.
  @Patch(':nic')
  async update(@Param('nic') nic: string, @Body() dto: UpdateApplicantDto) {
    const applicant = await this.applicantsService.update(nic, dto)
    return { ok: true, applicant }
  }
}
