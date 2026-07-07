import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator'

export const STAFF_ROLES = [
  'Admin',
  'Coordinator',
  'Technical Officer',
  'Manager L1',
  'Manager L2',
  'Manager L3',
  'Bank',
]

// Body of POST /api/admin/roles — an admin creating a new staff account.
export class CreateRoleDto {
  @IsIn(STAFF_ROLES, { message: 'Choose a valid role.' })
  role: string

  @IsString() @MinLength(2, { message: 'First name is required.' }) firstName: string
  @IsString() @MinLength(1, { message: 'Last name is required.' }) lastName: string
  @IsOptional() @IsString() initials?: string

  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' })
  nic: string

  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string

  @IsOptional() @IsString() phone?: string

  // For a Bank account, the Branch Code becomes the login ID (external login).
  @IsOptional() @IsString() branchCode?: string
  @IsOptional() @IsString() branchName?: string
  @IsOptional() @IsString() bankName?: string
  @IsOptional() @IsString() designation?: string

  @IsString() @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password: string

  @IsOptional() @IsString() dateOfBirth?: string
  @IsOptional() @IsString() province?: string
  @IsOptional() @IsString() district?: string
  @IsOptional() @IsString() city?: string
  @IsOptional() @IsString() postalCode?: string
  @IsOptional() @IsString() address?: string
}
