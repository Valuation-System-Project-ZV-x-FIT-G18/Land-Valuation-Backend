import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { NIC_MESSAGE, NIC_PATTERN } from '../../../../Common_Pages/validation/patterns'

const ALLOWED_DOC_STATUSES = ['Approved', 'Resubmit', 'Rejected'] as const

// Body fields for POST /api/applicant/documents (multipart/form-data).
// projectId may be blank — an applicant can upload documents right after
// registering, before a coordinator has created a project for them yet.
// Those land in a per-applicant "general" bucket (project_id = '').
export class UploadDocumentDto {
  @Matches(NIC_PATTERN, { message: NIC_MESSAGE }) nic: string
  @IsOptional() @IsString() @MaxLength(20) projectId?: string
  @IsString() @MinLength(1) @MaxLength(60) docType: string
}

// Body of POST /api/applicant/documents/status.
export class SetDocumentStatusDto {
  @Matches(NIC_PATTERN, { message: NIC_MESSAGE }) nic: string
  @IsOptional() @IsString() @MaxLength(20) projectId?: string
  @IsString() @MinLength(1) @MaxLength(60) docType: string
  @IsIn(ALLOWED_DOC_STATUSES, { message: 'Status must be Approved, Resubmit, or Rejected.' }) status: string
  @IsOptional() @IsString() @MaxLength(100) label?: string
}
