import { IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_PATTERN } from '../../../Common_Pages/validation/patterns'

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Current password is required.' })
  @MaxLength(100)
  currentPassword: string

  @IsString()
  @MaxLength(100)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE })
  newPassword: string
}
