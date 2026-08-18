import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { CITY_MESSAGE, CITY_PATTERN, NAME_MESSAGE, NAME_PATTERN, PHONE_MESSAGE, PHONE_PATTERN } from '../../../Common_Pages/validation/patterns'
import { STAFF_ROLES } from './create-role.dto'

const EDITABLE_ROLES = [...STAFF_ROLES, 'Loan Applicant']

// Body for PUT /api/admin/users/:userId (Admin > User Details > Edit).
// Identity fields (userId, role, nic) are never changed here.
export class UpdateUserDto {
  @IsString() @MinLength(1, { message: 'First name is required.' }) @MaxLength(60)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) firstName: string

  @IsOptional() @IsString() @MaxLength(60)
  @Matches(NAME_PATTERN, { message: NAME_MESSAGE }) lastName?: string

  // @IsOptional() only skips null/undefined, not '' — a Bank account can have
  // no email on file, so use @ValidateIf to genuinely skip when it's blank.
  @IsIn(EDITABLE_ROLES, { message: 'Choose a valid role.' }) role: string

  @IsOptional()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone?: string

  @IsOptional() @IsString() @MaxLength(60) province?: string
  @IsOptional() @IsString() @MaxLength(60) district?: string
  @IsOptional() @IsString() @MaxLength(60)
  @Matches(CITY_PATTERN, { message: CITY_MESSAGE }) city?: string
}
