import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { FleetService } from './fleet.service'
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'
import {
  AcceptRejectionDto,
  AssignmentActionDto,
  AssignFleetDto,
  MarkLeaveDto,
  LeaveActionDto,
  RejectAssignmentDto,
  RemoveLeaveDto,
} from './dto/fleet.dto'

@Controller('coordinator/fleet')
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  // GET /api/coordinator/fleet/officers — the four categorized officer lists.
  @Get('officers')
  async officers() {
    return this.fleet.officers()
  }

  // GET /api/coordinator/fleet/unassigned — work waiting + officers free today.
  @Get('unassigned')
  async unassigned() {
    return this.fleet.unassigned()
  }

  // GET /api/coordinator/fleet/work?q=<NIC or Project ID>
  @Get('work')
  async work(@Query('q') q: string) {
    return this.fleet.searchWork(q ?? '')
  }

  // POST /api/coordinator/fleet/assign  { valuationRowId, toId, date, time }
  @Post('assign')
  async assign(@Body() dto: AssignFleetDto) {
    return this.fleet.assign(dto.valuationRowId, dto.toId, dto.date, dto.time)
  }

  // POST /api/coordinator/fleet/accept-rejection  { valuationRowId }
  @Post('accept-rejection')
  async acceptRejection(@Body() dto: AcceptRejectionDto) {
    return this.fleet.acceptRejection(dto.valuationRowId)
  }

  // POST /api/coordinator/fleet/accept-assignment  { valuationRowId, toId }
  @Post('accept-assignment')
  async acceptAssignment(@CurrentUser() user: AuthUser, @Body() dto: AssignmentActionDto) {
    // A technical officer may only act on their own assignment, so the officer
    // id comes from the token rather than the request body.
    const officerId = user.role === 'Technical Officer' ? user.userId : dto.toId
    return this.fleet.acceptAssignment(dto.valuationRowId, officerId)
  }

  // POST /api/coordinator/fleet/reject  { valuationRowId, toId, reason }
  @Post('reject')
  async reject(@CurrentUser() user: AuthUser, @Body() dto: RejectAssignmentDto) {
    const officerId = user.role === 'Technical Officer' ? user.userId : dto.toId
    return this.fleet.rejectAssignment(dto.valuationRowId, officerId, dto.reason)
  }

  // GET /api/coordinator/fleet/leaves?toId= — today's + upcoming marked leaves.
  @Get('leaves')
  async leaves(@CurrentUser() user: AuthUser, @Query('toId') toId: string) {
    const officerId = user.role === 'Technical Officer' ? user.userId : (toId ?? '')
    return { leaves: await this.fleet.leaves(officerId) }
  }

  // POST /api/coordinator/fleet/mark-leave  { toId, reason, date }
  @Post('mark-leave')
  async markLeave(@CurrentUser() user: AuthUser, @Body() dto: MarkLeaveDto) {
    const officerId = user.role === 'Technical Officer' ? user.userId : dto.toId
    return this.fleet.markLeave(officerId, dto.reason ?? '', dto.date)
  }

  // POST /api/coordinator/fleet/remove-leave  { id }
  @Post('remove-leave')
  async removeLeave(@CurrentUser() user: AuthUser, @Body() dto: RemoveLeaveDto) {
    return this.fleet.removeLeave(dto.id, user.role === 'Technical Officer' ? user.userId : '')
  }

  // POST /api/coordinator/fleet/approve-leave  { id }
  @Post('approve-leave')
  async approveLeave(@Body() dto: LeaveActionDto) {
    return this.fleet.reviewLeave(dto.id, 'Approved')
  }

  // POST /api/coordinator/fleet/reject-leave  { id }
  @Post('reject-leave')
  async rejectLeave(@Body() dto: LeaveActionDto) {
    return this.fleet.reviewLeave(dto.id, 'Rejected')
  }
}
