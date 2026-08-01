import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ManagerDraftsService } from './manager-drafts.service'
import { DraftActionDto } from './dto/action.dto'

@Controller('manager/drafts')
export class ManagerDraftsController {
  constructor(private readonly service: ManagerDraftsService) {}

  // GET /api/manager/drafts/projects?level=L1|L2|L3&view=check|corrections|final|approved|rejected
  @Get('projects')
  async projects(@Query('level') level: string, @Query('view') view: string) {
    const v =
      view === 'corrections' ? 'corrections'
      : view === 'final' ? 'final'
      : view === 'approved' ? 'approved'
      : view === 'rejected' ? 'rejected'
      : 'check'
    return { projects: await this.service.projects(level ?? 'L3', v) }
  }

  // POST /api/manager/drafts/action
  @Post('action')
  async action(@Body() dto: DraftActionDto) {
    return this.service.action(dto.projectId, dto.reportHtml, dto.status, dto.reason ?? '')
  }
}
