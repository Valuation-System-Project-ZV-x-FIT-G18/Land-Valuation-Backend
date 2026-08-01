import { IsString, MaxLength, MinLength } from 'class-validator'
import { Transform } from 'class-transformer'

// Body of POST /api/coordinator/valuations/assign.
export class AssignOfficerDto {
  // rowId comes back from other endpoints (create/details/by-project) as a
  // number, so accept that shape here too instead of rejecting it.
  @Transform(({ value }) => String(value))
  @IsString() @MinLength(1) @MaxLength(20) rowId: string
  @IsString() @MinLength(1) @MaxLength(20) technicalOfficerId: string
}
