import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { CITY_MESSAGE, CITY_PATTERN, PHONE_MESSAGE, PHONE_PATTERN } from '../../../../Common_Pages/validation/patterns'

export class CreateBankBranchDto {
  @IsString() @MinLength(2) @MaxLength(150) bankName: string
  @IsString() @MinLength(1) @MaxLength(30) branchCode: string
  @IsString() @MinLength(2) @MaxLength(120) branchName: string
  @IsOptional() @IsString() @MaxLength(80) @Matches(CITY_PATTERN, { message: CITY_MESSAGE }) city?: string
  @IsOptional() @IsString() @MaxLength(120) contactName?: string
  @IsOptional() @IsString() @MaxLength(100) designation?: string
  @ValidateIf((value) => !!value.email?.trim()) @IsEmail() @MaxLength(254) email?: string
  @ValidateIf((value) => !!value.phone?.trim()) @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE }) phone?: string
}
