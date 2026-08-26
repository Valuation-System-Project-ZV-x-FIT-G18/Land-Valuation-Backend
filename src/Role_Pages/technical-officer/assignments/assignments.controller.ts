import { Controller, Get } from '@nestjs/common'
import { AssignmentsService } from './assignments.service'
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

@Controller('technical-officer/assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  // GET /api/technical-officer/assignments?toId=TO001
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return { assignments: await this.assignments.list(user.userId) }
  }
}
