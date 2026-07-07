import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common'
import { AuthService } from './auth.service'
import { UsersService } from './users.service'
import { LoginDto } from './dto/login.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly users: UsersService,
  ) {}

  // POST /api/auth/login
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.login(dto)
    return { ok: true, user }
  }

  // POST /api/auth/forgot-password  { identifier }  (login ID / email / NIC)
  @Post('forgot-password')
  async forgotPassword(@Body() body: { identifier: string }) {
    return this.authService.forgotPassword(String(body.identifier ?? ''))
  }

  // POST /api/auth/change-password
  @Post('change-password')
  async changePassword(@Body() dto: ChangePasswordDto) {
    const user = await this.authService.changePassword(dto)
    return { ok: true, user }
  }

  // GET /api/auth/profile?userId=... — the Settings page profile.
  @Get('profile')
  async getProfile(@Query('userId') userId: string) {
    const profile = await this.users.getProfile(userId ?? '')
    return { profile: profile ?? undefined }
  }

  // PUT /api/auth/profile — save the Settings page changes.
  @Put('profile')
  async updateProfile(@Body() dto: UpdateProfileDto) {
    const profile = await this.users.updateProfile(dto.userId, dto)
    return { ok: true, profile }
  }
}
