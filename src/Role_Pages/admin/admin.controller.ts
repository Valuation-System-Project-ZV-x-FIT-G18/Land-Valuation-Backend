import { Body, Controller, Post } from '@nestjs/common'
import { AdminService } from './admin.service'
import { CreateRoleDto } from './dto/create-role.dto'

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // POST /api/admin/roles — create a new staff account and email their login.
  @Post('roles')
  async addRole(@Body() dto: CreateRoleDto) {
    const { userId } = await this.admin.addRole(dto)
    return { ok: true, userId }
  }
}
