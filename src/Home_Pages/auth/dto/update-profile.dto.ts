import { IsEmail, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class UpdateProfileDto {
  @IsString()
  @MinLength(1, { message: 'User ID is required.' })
  @MaxLength(50)
  userId: string

  @IsOptional() @IsString() @MaxLength(60) firstName?: string
  @IsOptional() @IsString() @MaxLength(60) lastName?: string
  @IsOptional() @IsString() @MaxLength(60) initials?: string

  @IsOptional()
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(100)
  email?: string

  @IsOptional()
  @Matches(/^07\d{8}$/, { message: 'Enter a valid mobile number (e.g. 0771234567).' })
  phone?: string

  @IsOptional()
  @IsISO8601({}, { message: 'Date of birth must be a valid date (YYYY-MM-DD).' })
  dateOfBirth?: string

  @IsOptional() @IsString() @MaxLength(60) province?: string
  @IsOptional() @IsString() @MaxLength(60) district?: string
  @IsOptional() @IsString() @MaxLength(60) city?: string
  @IsOptional() @IsString() @MaxLength(10) postalCode?: string
  @IsOptional() @IsString() @MaxLength(255) address?: string
}
