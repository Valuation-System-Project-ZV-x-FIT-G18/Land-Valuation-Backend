import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { NAME_MESSAGE, NAME_PATTERN, PHONE_MESSAGE, REQUIRED_PHONE_PATTERN } from '../../../../Common_Pages/validation/patterns'

// Fields a coordinator may correct on an already-registered applicant.
// The NIC is intentionally NOT here: it is the applicant's user_id (login id
// and primary key), so it cannot be changed by an edit.
export class UpdateApplicantDto {
  @IsString() @MinLength(2, { message: 'First name must be at least 2 characters.' }) @MaxLength(60)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) firstName: string

  @IsString() @MinLength(1) @MaxLength(60)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) lastName: string

  @IsString() @MaxLength(60, { message: 'Name with initials cannot exceed 60 characters.' }) initials: string

  @IsOptional() @IsString()
  @MaxLength(150, { message: 'Business name cannot exceed 150 characters.' })
  applicantBusinessName?: string

  @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(100) email: string

  @Matches(REQUIRED_PHONE_PATTERN, { message: PHONE_MESSAGE }) phone: string
}
