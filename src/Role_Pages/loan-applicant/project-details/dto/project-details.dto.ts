import { IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import { NIC_MESSAGE, NIC_PATTERN } from '../../../../Common_Pages/validation/patterns'

// Body of POST /api/applicant/project-details — the applicant saves a new
// draft. `data` is a free-form { fieldName: value } map (same field set as
// the coordinator's Create Project form, minus document uploads), so it
// isn't validated field-by-field here.
export class CreateProjectDetailsDto {
  @Matches(NIC_PATTERN, { message: NIC_MESSAGE }) nic: string
  @IsOptional() @IsString() @MaxLength(100) label?: string
  @IsObject() data: Record<string, string>
}

// Body of PUT /api/applicant/project-details/:id — the applicant updates one
// of their own drafts.
export class UpdateProjectDetailsDto {
  @Matches(NIC_PATTERN, { message: NIC_MESSAGE }) nic: string
  @IsOptional() @IsString() @MaxLength(100) label?: string
  @IsObject() data: Record<string, string>
}
