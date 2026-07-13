import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

// Body of POST /api/coordinator/valuations (multipart/form-data).
// `data` is a JSON-encoded string containing the full valuation form fields.
export class CreateValuationRequestDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsString() @MinLength(1) @MaxLength(20) applicantNic: string
  @IsOptional() @IsString() data?: string
}
