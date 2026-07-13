import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { FleetService } from './fleet.service'
import {
  AcceptRejectionDto,
  AssignFleetDto,
  MarkLeaveDto,
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

  // POST /api/coordinator/fleet/reject  { valuationRowId, toId, reason }
  @Post('reject')
  async reject(@Body() dto: RejectAssignmentDto) {
    return this.fleet.rejectAssignment(dto.valuationRowId, dto.toId, dto.reason)
  }

  // GET /api/coordinator/fleet/leaves?toId= — today's + upcoming marked leaves.
  @Get('leaves')
  async leaves(@Query('toId') toId: string) {
    return { leaves: await this.fleet.leaves(toId ?? '') }
  }

  // POST /api/coordinator/fleet/mark-leave  { toId, reason, date }
  @Post('mark-leave')
  async markLeave(@Body() dto: MarkLeaveDto) {
    return this.fleet.markLeave(dto.toId, dto.reason ?? '', dto.date)
  }

  // POST /api/coordinator/fleet/remove-leave  { id }
  @Post('remove-leave')
  async removeLeave(@Body() dto: RemoveLeaveDto) {
    return this.fleet.removeLeave(dto.id)
  }
}
