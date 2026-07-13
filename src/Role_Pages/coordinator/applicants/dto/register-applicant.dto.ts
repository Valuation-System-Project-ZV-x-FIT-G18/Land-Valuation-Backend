import { IsEmail, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class RegisterApplicantDto {
  @IsString() @MinLength(2, { message: 'First name must be at least 2 characters.' }) @MaxLength(60) firstName: string
  @IsString() @MinLength(1) @MaxLength(60) lastName: string
  @IsString() @MaxLength(60) initials: string

  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' }) nic: string

  @IsOptional()
  @IsISO8601({}, { message: 'Date of birth must be a valid date (YYYY-MM-DD).' })
  dateOfBirth?: string

  @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(100) email: string

  @Matches(/^07\d{8}$/, { message: 'Enter a valid mobile number (e.g. 0771234567).' }) phone: string

  @IsString() @MinLength(8, { message: 'Password must be at least 8 characters.' }) @MaxLength(100) password: string

  @IsOptional() @IsString() @MaxLength(60) province?: string
  @IsOptional() @IsString() @MaxLength(60) district?: string
  @IsOptional() @IsString() @MaxLength(60) city?: string
  @IsOptional() @IsString() @MaxLength(255) address?: string
  @IsOptional() @IsString() @MaxLength(10) postalCode?: string
}
