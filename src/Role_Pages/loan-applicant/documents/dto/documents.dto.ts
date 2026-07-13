import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

const ALLOWED_DOC_STATUSES = ['Approved', 'Resubmit', 'Rejected'] as const

// Body fields for POST /api/applicant/documents (multipart/form-data).
export class UploadDocumentDto {
  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' }) nic: string
  @IsString() @MinLength(1) @MaxLength(60) docType: string
}

// Body of POST /api/applicant/documents/status.
export class SetDocumentStatusDto {
  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' }) nic: string
  @IsString() @MinLength(1) @MaxLength(60) docType: string
  @IsIn(ALLOWED_DOC_STATUSES, { message: 'Status must be Approved, Resubmit, or Rejected.' }) status: string
  @IsOptional() @IsString() @MaxLength(100) label?: string
}
