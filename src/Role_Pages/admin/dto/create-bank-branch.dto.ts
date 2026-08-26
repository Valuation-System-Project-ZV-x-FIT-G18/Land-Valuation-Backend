import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { PHONE_MESSAGE, PHONE_PATTERN } from '../../../Common_Pages/validation/patterns'

// Body of POST /api/admin/banks/:bankId/branches.
//
// This endpoint previously took an untyped object, so nothing was validated:
// a branch could be saved with a malformed phone number or a value that is not
// an email at all. The contact fields are optional, but anything supplied is
// held to the same rules as every other phone/email field in the app.
export class CreateBankBranchDto {
  @IsString() @MinLength(2, { message: 'Enter a valid branch name.' }) @MaxLength(120)
  branchName: string

  @IsString() @Matches(/^\d{2,10}$/, { message: 'Enter the official numeric branch code (2–10 digits).' })
  branchCode: string

  @IsOptional() @IsString() @MaxLength(80)
  city?: string

  @IsOptional() @IsString() @MaxLength(120)
  contactPerson?: string

  // Validated only when something was typed, so the field stays optional.
  @ValidateIf((dto: CreateBankBranchDto) => !!dto.contactNumber?.trim())
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  contactNumber?: string

  @ValidateIf((dto: CreateBankBranchDto) => !!dto.contactEmail?.trim())
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  contactEmail?: string
}
