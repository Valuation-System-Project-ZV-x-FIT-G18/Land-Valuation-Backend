import { IsString, MaxLength, MinLength } from 'class-validator'

export class ForgotPasswordDto {
  @IsString()
  @MinLength(1, { message: 'Identifier is required.' })
  @MaxLength(100)
  identifier: string
}
