import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { NAME_MESSAGE, NAME_PATTERN } from '../../../../Common_Pages/validation/patterns'

export class CreateBankDto {
  @IsString() @MinLength(2, { message: 'Choose a bank.' }) @MaxLength(100) bankName: string
  @IsOptional() @IsString() @MaxLength(100) branchName?: string
  @IsString() @MinLength(1, { message: 'Branch code is required.' }) @MaxLength(20) branchCode: string

  @IsString() @MinLength(2, { message: "Officer's name is required." }) @MaxLength(100)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) officerName: string

  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' }) officerNic: string

  @Matches(/^(07\d{8}|0[1-9]\d{7,8}|[1-9]\d{8,9})$/, {
    message: 'Enter a valid contact number.',
  })
  contact: string

  @IsString() @MinLength(1, { message: 'Enter the applicant NIC or Project ID.' }) @MaxLength(20) projectRef: string

  // @IsOptional() only skips null/undefined, not '' — the officer's email is
  // optional here, so use @ValidateIf to genuinely skip when it's blank.
  @ValidateIf((o) => !!o.email)
  @IsEmail({}, { message: 'Enter a valid email.' }) @MaxLength(100) email?: string
  @IsOptional() @IsString() @MaxLength(255) address?: string
}
