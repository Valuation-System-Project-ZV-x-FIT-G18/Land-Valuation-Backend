import { IsEmail, IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { CITY_MESSAGE, CITY_PATTERN, NAME_MESSAGE, NAME_PATTERN, PHONE_MESSAGE, PHONE_PATTERN, STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_PATTERN } from '../../../Common_Pages/validation/patterns'

export const STAFF_ROLES = [
  'Admin', 'Coordinator', 'Technical Officer',
  'Manager L1', 'Manager L2', 'Manager L3', 'Bank',
]

export class CreateRoleDto {
  @IsIn(STAFF_ROLES, { message: 'Choose a valid role.' }) role: string

  @IsString() @MinLength(2, { message: 'First name is required.' }) @MaxLength(60)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) firstName: string

  @IsString() @MinLength(1, { message: 'Last name is required.' }) @MaxLength(60)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) lastName: string

  @IsOptional() @IsString() @MaxLength(60) initials?: string

  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' }) nic: string

  @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(100) email: string

  @IsOptional()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone?: string

  @IsOptional() @IsString() @MaxLength(20) branchCode?: string
  @IsOptional() @IsString() @MaxLength(100) branchName?: string
  @IsOptional() @IsString() @MaxLength(100) bankName?: string
  @IsOptional() @IsString() @MaxLength(100) designation?: string

  @IsString() @MaxLength(100)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE }) password: string

  // @IsOptional() only skips null/undefined, not '' — Bank accounts submit an
  // empty string (the Date of Birth field is hidden for that role), so use
  // @ValidateIf to genuinely skip validation when it's blank.
  @ValidateIf((o) => !!o.dateOfBirth)
  @IsISO8601({}, { message: 'Date of birth must be a valid date.' })
  dateOfBirth?: string
  @IsOptional() @IsString() @MaxLength(60) province?: string
  @IsOptional() @IsString() @MaxLength(60) district?: string
  @IsOptional() @IsString() @MaxLength(60)
  @Matches(CITY_PATTERN, { message: CITY_MESSAGE }) city?: string
  @IsOptional() @IsString() @MaxLength(10) postalCode?: string
  @IsOptional() @IsString() @MaxLength(255) address?: string
}
