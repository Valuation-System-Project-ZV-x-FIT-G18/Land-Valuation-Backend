import { IsString, MaxLength, MinLength } from 'class-validator'

export class LoginDto {
  @IsString()
  @MinLength(1, { message: 'User ID is required.' })
  @MaxLength(50)
  userId: string

  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  @MaxLength(100)
  password: string
}
