import { IsEmail, IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export const STAFF_ROLES = [
  'Admin', 'Coordinator', 'Technical Officer',
  'Manager L1', 'Manager L2', 'Manager L3', 'Bank',
]

export class CreateRoleDto {
  @IsIn(STAFF_ROLES, { message: 'Choose a valid role.' }) role: string

  @IsString() @MinLength(2, { message: 'First name is required.' }) @MaxLength(60) firstName: string
  @IsString() @MinLength(1, { message: 'Last name is required.' }) @MaxLength(60) lastName: string
  @IsOptional() @IsString() @MaxLength(60) initials?: string

  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' }) nic: string

  @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(100) email: string

  @IsOptional()
  @Matches(/^(07\d{8}|0[1-9]\d{7,8})$/, { message: 'Enter a valid phone number.' })
  phone?: string

  @IsOptional() @IsString() @MaxLength(20) branchCode?: string
  @IsOptional() @IsString() @MaxLength(100) branchName?: string
  @IsOptional() @IsString() @MaxLength(100) bankName?: string
  @IsOptional() @IsString() @MaxLength(100) designation?: string

  @IsString() @MinLength(8, { message: 'Password must be at least 8 characters.' }) @MaxLength(100) password: string

  @IsOptional() @IsISO8601({}, { message: 'Date of birth must be a valid date.' }) dateOfBirth?: string
  @IsOptional() @IsString() @MaxLength(60) province?: string
  @IsOptional() @IsString() @MaxLength(60) district?: string
  @IsOptional() @IsString() @MaxLength(60) city?: string
  @IsOptional() @IsString() @MaxLength(10) postalCode?: string
  @IsOptional() @IsString() @MaxLength(255) address?: string
}
