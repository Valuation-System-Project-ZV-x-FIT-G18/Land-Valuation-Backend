import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { FleetService } from './fleet.service'

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

  // GET /api/coordinator/fleet/work?q=<NIC or Project ID> — projects + valuations
  // with any existing assignment, for the search-driven assign flow.
  @Get('work')
  async work(@Query('q') q: string) {
    return this.fleet.searchWork(q ?? '')
  }

  // POST /api/coordinator/fleet/assign  { valuationRowId, toId, date, time }
  @Post('assign')
  async assign(
    @Body() body: { valuationRowId: string; toId: string; date: string; time: string },
  ) {
    return this.fleet.assign(
      String(body.valuationRowId ?? ''),
      String(body.toId ?? ''),
      String(body.date ?? ''),
      String(body.time ?? ''),
    )
  }

  // POST /api/coordinator/fleet/accept-rejection  { valuationRowId }
  @Post('accept-rejection')
  async acceptRejection(@Body() body: { valuationRowId: string }) {
    return this.fleet.acceptRejection(String(body.valuationRowId ?? ''))
  }

  // POST /api/coordinator/fleet/reject  { valuationRowId, toId, reason } — TO rejects.
  @Post('reject')
  async reject(@Body() body: { valuationRowId: string; toId: string; reason: string }) {
    return this.fleet.rejectAssignment(
      String(body.valuationRowId ?? ''),
      String(body.toId ?? ''),
      String(body.reason ?? ''),
    )
  }

  // GET /api/coordinator/fleet/leaves?toId= — today's + upcoming marked leaves.
  @Get('leaves')
  async leaves(@Query('toId') toId: string) {
    return { leaves: await this.fleet.leaves(toId ?? '') }
  }

  // POST /api/coordinator/fleet/mark-leave  { toId, reason, date }
  @Post('mark-leave')
  async markLeave(@Body() body: { toId: string; reason: string; date: string }) {
    return this.fleet.markLeave(String(body.toId ?? ''), String(body.reason ?? ''), String(body.date ?? ''))
  }

  // POST /api/coordinator/fleet/remove-leave  { id }
  @Post('remove-leave')
  async removeLeave(@Body() body: { id: string }) {
    return this.fleet.removeLeave(String(body.id ?? ''))
  }
}
