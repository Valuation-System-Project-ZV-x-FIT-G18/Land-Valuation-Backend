import { IsString, MaxLength, MinLength } from 'class-validator'

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'User ID is required.' })
  @MaxLength(50)
  userId: string

  @IsString()
  @MinLength(1, { message: 'Current password is required.' })
  @MaxLength(100)
  currentPassword: string

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters.' })
  @MaxLength(100)
  newPassword: string
}
