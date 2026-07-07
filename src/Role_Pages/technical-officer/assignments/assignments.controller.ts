import { Controller, Get, Query } from '@nestjs/common'
import { AssignmentsService } from './assignments.service'

@Controller('technical-officer/assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  // GET /api/technical-officer/assignments?toId=TO001
  @Get()
  async list(@Query('toId') toId: string) {
    return { assignments: await this.assignments.list(toId ?? '') }
  }
}
