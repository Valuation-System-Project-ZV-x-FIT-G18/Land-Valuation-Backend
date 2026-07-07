import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator'

// Body of POST /api/coordinator/banks — registering a bank branch/officer.
export class CreateBankDto {
  @IsString() @MinLength(2, { message: 'Choose a bank.' }) bankName: string

  @IsOptional() @IsString() branchName?: string

  @IsString() @MinLength(1, { message: 'Branch code is required.' }) branchCode: string

  @IsString() @MinLength(2, { message: "Officer's name is required." }) officerName: string

  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' })
  officerNic: string

  @IsString() @MinLength(1, { message: 'Contact number is required.' }) contact: string

  // Links this bank request to a project — the applicant's NIC or a Project ID.
  @IsString() @MinLength(1, { message: 'Enter the applicant NIC or Project ID.' })
  projectRef: string

  @IsOptional() @IsEmail({}, { message: 'Enter a valid email.' }) email?: string
  @IsOptional() @IsString() address?: string
}
