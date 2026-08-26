import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import type { Response } from 'express'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { UsersService } from './users.service'
import { LoginDto } from './dto/login.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { Public } from './decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import type { AuthUser } from './types/auth-user'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly users: UsersService,
  ) {}

  // POST /api/auth/login
  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto)
    this.setRefreshCookie(response, result.refreshToken)
    return { ok: true, user: result.user, accessToken: result.accessToken }
  }

  @Post('refresh')
  @Public()
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = this.readCookie(request, 'refresh_token')
    const result = await this.authService.refresh(token)
    this.setRefreshCookie(response, result.refreshToken)
    return { ok: true, accessToken: result.accessToken }
  }

  @Post('logout')
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(user.userId)
    response.clearCookie('refresh_token', { path: '/api/auth' })
    return { ok: true }
  }

  // POST /api/auth/forgot-password { email }
  @Post('forgot-password')
  @Public()
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email)
  }

  // POST /api/auth/change-password
  @Post('change-password')
  async changePassword(@CurrentUser() currentUser: AuthUser, @Body() dto: ChangePasswordDto) {
    const user = await this.authService.changePassword(currentUser.userId, dto)
    return { ok: true, user }
  }

  // GET /api/auth/profile — the authenticated user's Settings profile.
  @Get('profile')
  async getProfile(@CurrentUser() user: AuthUser) {
    const profile = await this.users.getProfile(user.userId)
    return { profile: profile ?? undefined }
  }

  // PUT /api/auth/profile — save the Settings page changes.
  @Put('profile')
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    const profile = await this.users.updateProfile(user.userId, dto)
    return { ok: true, profile }
  }

  // POST /api/auth/avatar — upload/replace the logged-in user's profile picture.
  // memoryStorage() keeps the file in memory (file.buffer) instead of writing
  // it to disk, so the bytes go straight into the database.
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) return { ok: false, error: 'No image was received.' }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return { ok: false, error: 'Please upload a JPG, PNG, WEBP, or GIF image.' }
    }
    // Just a cache-busting token for the frontend's <img src> — has no
    // meaning on disk, since there is no file anymore.
    const token = `db-${Date.now()}-${Math.round(Math.random() * 1e9)}`
    await this.users.setPhoto(user.userId, file, token)
    return { ok: true, photoPath: token }
  }

  // GET /api/auth/avatar?userId=... — serve the stored profile picture from the
  // database. Signed-in only: profile pictures are staff directory data, and a
  // public version let anyone read every user's photo by guessing ids.
  @Get('avatar')
  async avatar(@Query('userId') userId: string, @Res() res: Response) {
    const photo = await this.users.getPhoto(userId ?? '')
    if (!photo) { res.status(404).json({ error: 'No profile picture set.' }); return }
    res.set('Content-Type', photo.mime)
    res.send(photo.data)
  }

  private setRefreshCookie(response: Response, token: string) {
    response.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
  }

  private readCookie(request: Request, name: string) {
    const value = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1)
    return value ? decodeURIComponent(value) : ''
  }
}
