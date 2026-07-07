import { IsString, MinLength } from 'class-validator'

// Body of POST /api/auth/change-password.
export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'User ID is required.' })
  userId: string

  @IsString()
  @MinLength(1, { message: 'Current password is required.' })
  currentPassword: string

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters.' })
  newPassword: string
}
