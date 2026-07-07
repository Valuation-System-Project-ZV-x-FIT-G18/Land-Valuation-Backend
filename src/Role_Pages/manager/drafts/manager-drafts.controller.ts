import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ManagerDraftsService } from './manager-drafts.service'

// Manager — "Check Drafts": review workflow across L3 → L2 → L1.
@Controller('manager/drafts')
export class ManagerDraftsController {
  constructor(private readonly service: ManagerDraftsService) {}

  // GET /api/manager/drafts/projects?level=L1|L2|L3&view=check|corrections
  @Get('projects')
  async projects(@Query('level') level: string, @Query('view') view: string) {
    const v = view === 'corrections' ? 'corrections' : view === 'final' ? 'final' : 'check'
    return { projects: await this.service.projects(level ?? 'L3', v) }
  }

  // POST /api/manager/drafts/action — save the report + change review status.
  @Post('action')
  async action(
    @Body() body: { projectId: string; reportHtml?: string; status: string; reason?: string },
  ) {
    return this.service.action(String(body.projectId ?? ''), body.reportHtml, String(body.status ?? ''), body.reason ?? '')
  }
}
