import { IsObject, IsString, MaxLength, MinLength } from 'class-validator'

// Body of POST /api/technical-officer/inspections.
export class SaveInspectionDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsString() @MinLength(1) @MaxLength(20) toId: string
  @IsObject() data: Record<string, string>
}
