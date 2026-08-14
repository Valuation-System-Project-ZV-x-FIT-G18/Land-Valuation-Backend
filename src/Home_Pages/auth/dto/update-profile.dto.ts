import { IsEmail, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { CITY_MESSAGE, CITY_PATTERN, NAME_MESSAGE, NAME_PATTERN, PHONE_MESSAGE, PHONE_PATTERN, POSTAL_CODE_MESSAGE, POSTAL_CODE_PATTERN } from '../../../Common_Pages/validation/patterns'

export class UpdateProfileDto {
  @IsString()
  @MinLength(1, { message: 'User ID is required.' })
  @MaxLength(50)
  userId: string

  @IsOptional() @IsString() @MaxLength(60)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) firstName?: string

  @IsOptional() @IsString() @MaxLength(60)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) lastName?: string

  @IsOptional() @IsString() @MaxLength(60) initials?: string

  @IsOptional()
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(100)
  email?: string

  @IsOptional()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone?: string

  // @IsOptional() only skips null/undefined, not '' — use @ValidateIf so a
  // blank date is genuinely skipped instead of failing IsISO8601.
  @ValidateIf((o) => !!o.dateOfBirth)
  @IsISO8601({}, { message: 'Date of birth must be a valid date (YYYY-MM-DD).' })
  dateOfBirth?: string

  @IsOptional() @IsString() @MaxLength(60) province?: string
  @IsOptional() @IsString() @MaxLength(60) district?: string
  @IsOptional() @IsString() @MaxLength(60)
  @Matches(CITY_PATTERN, { message: CITY_MESSAGE }) city?: string
  @IsOptional() @IsString() @MaxLength(10)
  @Matches(POSTAL_CODE_PATTERN, { message: POSTAL_CODE_MESSAGE }) postalCode?: string
  @IsOptional() @IsString() @MaxLength(255) address?: string
}
