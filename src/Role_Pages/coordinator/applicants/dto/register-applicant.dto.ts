import { IsEmail, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { CITY_MESSAGE, CITY_PATTERN, NAME_MESSAGE, NAME_PATTERN, STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_PATTERN } from '../../../../Common_Pages/validation/patterns'

export class RegisterApplicantDto {
  @IsString() @MinLength(2, { message: 'First name must be at least 2 characters.' }) @MaxLength(60)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) firstName: string

  @IsString() @MinLength(1) @MaxLength(60)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) lastName: string

  @IsString() @MaxLength(60) initials: string

  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' }) nic: string

  // @IsOptional() only skips null/undefined, not '' — use @ValidateIf so a
  // blank date is genuinely skipped instead of failing IsISO8601.
  @ValidateIf((o) => !!o.dateOfBirth)
  @IsISO8601({}, { message: 'Date of birth must be a valid date (YYYY-MM-DD).' })
  dateOfBirth?: string

  @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(100) email: string

  @Matches(/^7[1-9]\d{7}$/, { message: 'Enter a valid 9-digit mobile number starting with 7 (e.g. 712345678).' }) phone: string

  @IsString() @MaxLength(100)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE }) password: string

  @IsOptional() @IsString() @MaxLength(60) province?: string
  @IsOptional() @IsString() @MaxLength(60) district?: string
  @IsOptional() @IsString() @MaxLength(60)
  @Matches(CITY_PATTERN, { message: CITY_MESSAGE }) city?: string
  @IsOptional() @IsString() @MaxLength(255) address?: string
  @IsOptional() @IsString() @MaxLength(10) postalCode?: string
}
