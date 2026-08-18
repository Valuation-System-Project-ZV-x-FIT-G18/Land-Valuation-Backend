import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { BRANCH_CODE_MESSAGE, BRANCH_CODE_PATTERN, NAME_MESSAGE, NAME_PATTERN, NIC_MESSAGE, NIC_PATTERN, PHONE_MESSAGE, REQUIRED_PHONE_PATTERN } from '../../../../Common_Pages/validation/patterns'

export class CreateBankDto {
  @IsString() @MinLength(2, { message: 'Choose a bank.' }) @MaxLength(100) bankName: string
  @IsOptional() @IsString() @MaxLength(100) branchName?: string
  @IsString() @MinLength(1, { message: 'Branch code is required.' }) @MaxLength(20)
  @Matches(BRANCH_CODE_PATTERN, { message: BRANCH_CODE_MESSAGE }) branchCode: string

  @IsString() @MinLength(2, { message: "Officer's name is required." }) @MaxLength(100)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) officerName: string

  @Matches(NIC_PATTERN, { message: NIC_MESSAGE }) officerNic: string

  @Matches(REQUIRED_PHONE_PATTERN, { message: PHONE_MESSAGE })
  contact: string

  @IsString() @MinLength(1, { message: 'Enter the applicant NIC or Project ID.' }) @MaxLength(20) projectRef: string

  // @IsOptional() only skips null/undefined, not '' — the officer's email is
  // optional here, so use @ValidateIf to genuinely skip when it's blank.
  @ValidateIf((o) => !!o.email)
  @IsEmail({}, { message: 'Enter a valid email.' }) @MaxLength(100) email?: string
  @IsOptional() @IsString() @MaxLength(255) address?: string
}
