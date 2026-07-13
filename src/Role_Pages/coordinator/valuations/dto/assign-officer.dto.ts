import { IsString, MaxLength, MinLength } from 'class-validator'

// Body of POST /api/coordinator/valuations/assign.
export class AssignOfficerDto {
  @IsString() @MinLength(1) @MaxLength(20) rowId: string
  @IsString() @MinLength(1) @MaxLength(20) technicalOfficerId: string
}
