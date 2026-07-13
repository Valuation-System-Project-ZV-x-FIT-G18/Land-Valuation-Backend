import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

// Body of POST /api/coordinator/projects (multipart/form-data).
// `data` is a JSON-encoded string containing all form section fields.
export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(20) applicantNic: string
  @IsOptional() @IsString() @MaxLength(20) coordinatorId?: string
  @IsOptional() @IsString() data?: string
}
