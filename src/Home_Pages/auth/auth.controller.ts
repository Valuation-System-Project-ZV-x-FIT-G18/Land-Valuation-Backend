import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { Response } from 'express'
import { AuthService } from './auth.service'
import { UsersService } from './users.service'
import { LoginDto } from './dto/login.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { UploadAvatarDto } from './dto/upload-avatar.dto'

const uploadDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

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
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.identifier)
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

  // POST /api/auth/avatar — upload/replace the logged-in user's profile picture.
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) =>
          cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(@Body() dto: UploadAvatarDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) return { ok: false, error: 'No image was received.' }
    await this.users.setPhoto(dto.userId, file.filename)
    return { ok: true, photoPath: file.filename }
  }

  // GET /api/auth/avatar?userId=... — serve the stored profile picture.
  @Get('avatar')
  async avatar(@Query('userId') userId: string, @Res() res: Response) {
    const fileName = await this.users.getPhotoPath(userId ?? '')
    if (!fileName) { res.status(404).json({ error: 'No profile picture set.' }); return }
    res.sendFile(join(uploadDir, fileName))
  }
}
