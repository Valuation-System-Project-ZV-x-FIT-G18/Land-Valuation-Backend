import { IsString, MinLength } from 'class-validator'

// Body of POST /api/auth/login (internal staff login).
export class LoginDto {
  @IsString()
  @MinLength(1, { message: 'User ID is required.' })
  userId: string

  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  password: string
}
