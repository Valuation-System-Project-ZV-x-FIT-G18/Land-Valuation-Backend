import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common'
import { AdminService } from './admin.service'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateUserStatusDto } from './dto/update-user-status.dto'
import { CreateBankBranchDto } from './dto/create-bank-branch.dto'
import { CurrentUser } from '../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../Home_Pages/auth/types/auth-user'

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // POST /api/admin/roles — create a new staff account and email their login.
  @Post('roles')
  async addRole(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthUser) {
    const { userId } = await this.admin.addRole(dto, actor.userId)
    return { ok: true, userId }
  }

  // GET /api/admin/users — every registered account (User Details page).
  @Get('users')
  async listUsers() {
    return { users: await this.admin.listUsers() }
  }

  // PUT /api/admin/users/:userId — edit a user's basic details.
  @Put('users/:userId')
  async updateUser(@Param('userId') userId: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    await this.admin.updateUser(userId, dto, actor.userId)
    return { ok: true }
  }

  @Patch('users/:userId/status')
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.admin.updateUserStatus(userId, dto.status, actor.userId)
    return { ok: true }
  }


  // POST /api/admin/users/:userId/reset-password - email the user a fresh
  // temporary password and force a change at their next login.
  @Post('users/:userId/reset-password')
  async resetUserPassword(@Param('userId') userId: string, @CurrentUser() actor: AuthUser) {
    const { email } = await this.admin.resetUserPassword(userId, actor.userId)
    return { ok: true, email }
  }
  @Get('audit-logs')
  async auditLogs() {
    return { logs: await this.admin.listAuditLogs() }
  }

  @Get('banks')
  async listBanks() {
    return { banks: await this.admin.listBanks() }
  }

  @Post('banks')
  async createBank(
    @Body() dto: { name?: string },
    @CurrentUser() actor: AuthUser,
  ) {
    return { bank: await this.admin.createBank(dto.name ?? '', actor.userId) }
  }

  @Post('banks/:bankId/branches')
  async createBankBranch(
    @Param('bankId') bankId: string,
    @Body() dto: CreateBankBranchDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return {
      branch: await this.admin.createBankBranch(
        bankId,
        dto.branchName ?? '',
        dto.branchCode ?? '',
        dto.city ?? '',
        dto.contactPerson ?? '',
        dto.contactNumber ?? '',
        dto.contactEmail ?? '',
        actor.userId,
      ),
    }
  }

  // DELETE /api/admin/users/:userId - deactivates rather than deletes. Accounts
  // are never removed: projects, valuations and audit rows reference them.
  @Delete('users/:userId')
  async deleteUser(@Param('userId') userId: string, @CurrentUser() actor: AuthUser) {
    await this.admin.updateUserStatus(userId, 'Deactivated', actor.userId)
    return { ok: true }
  }

  @Delete('banks/:bankId/branches/:branchId')
  async deleteBankBranch(
    @Param('branchId') branchId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.admin.deleteBankBranch(branchId, actor.userId)
  }

  @Delete('banks/:bankId')
  async deleteBank(@Param('bankId') bankId: string, @CurrentUser() actor: AuthUser) {
    return this.admin.deleteBank(bankId, actor.userId)
  }
}
