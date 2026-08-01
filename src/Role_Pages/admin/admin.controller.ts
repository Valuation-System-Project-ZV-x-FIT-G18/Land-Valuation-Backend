import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common'
import { AdminService } from './admin.service'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateUserDto } from './dto/update-user.dto'

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // POST /api/admin/roles — create a new staff account and email their login.
  @Post('roles')
  async addRole(@Body() dto: CreateRoleDto) {
    const { userId } = await this.admin.addRole(dto)
    return { ok: true, userId }
  }

  // GET /api/admin/users — every registered account (User Details page).
  @Get('users')
  async listUsers() {
    return { users: await this.admin.listUsers() }
  }

  // PUT /api/admin/users/:userId — edit a user's basic details.
  @Put('users/:userId')
  async updateUser(@Param('userId') userId: string, @Body() dto: UpdateUserDto) {
    await this.admin.updateUser(userId, dto)
    return { ok: true }
  }

  // DELETE /api/admin/users/:userId — remove a user's account.
  @Delete('users/:userId')
  async deleteUser(@Param('userId') userId: string) {
    await this.admin.deleteUser(userId)
    return { ok: true }
  }
}
