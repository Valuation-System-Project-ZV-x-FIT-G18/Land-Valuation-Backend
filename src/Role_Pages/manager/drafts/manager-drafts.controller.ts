import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common'
import { ManagerDraftsService } from './manager-drafts.service'
import { DraftActionDto } from './dto/action.dto'
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

@Controller('manager/drafts')
export class ManagerDraftsController {
  constructor(private readonly service: ManagerDraftsService) {}

  // GET /api/manager/drafts/projects?level=L1|L2|L3&view=check|corrections|final|approved|rejected
  @Get('projects')
  async projects(@CurrentUser() user: AuthUser, @Query('level') level: string, @Query('view') view: string) {
    const v =
      view === 'corrections' ? 'corrections'
      : view === 'final' ? 'final'
      : view === 'approved' ? 'approved'
      : view === 'rejected' ? 'rejected'
      : 'check'
    return { projects: await this.service.projects(user, level ?? 'L3', v) }
  }

  // POST /api/manager/drafts/action
  @Post('action')
  async action(@CurrentUser() user: AuthUser, @Body() dto: DraftActionDto, @Headers('authorization') authorization: string) {
    return this.service.action(user, dto.projectId, dto.reportHtml, dto.status, dto.reason ?? '', dto.valuationDate, dto.reportPrice, authorization ?? '')
  }

  // Manager-authorized access to the one canonical saved report representation.
  @Get('report')
  async report(@CurrentUser() user: AuthUser, @Query('projectId') projectId: string) {
    return this.service.report(user, projectId ?? '')
  }

  @Get('fields')
  async fields(@Query('projectId') projectId: string) {
    return this.service.fields(projectId ?? '')
  }

  // Shared chronological workflow feed for all manager levels.
  @Get('recent-activities')
  async recentActivities(@Query('limit') limit?: string) {
    return { activities: await this.service.recentActivities(Number(limit ?? 8)) }
  }
}
