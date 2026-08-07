import { IsObject, Matches } from 'class-validator'

// Body of PUT /api/applicant/project-details — the applicant saves/updates
// their own copy of the project detail fields (same set as the coordinator's
// Create Project form, minus document uploads). `data` is a free-form
// { fieldName: value } map, so it isn't validated field-by-field here.
export class SaveProjectDetailsDto {
  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' }) nic: string
  @IsObject() data: Record<string, string>
}
