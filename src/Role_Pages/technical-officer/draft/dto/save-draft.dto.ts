import { IsObject, IsString, MaxLength, MinLength } from 'class-validator'

// Body of POST /api/technical-officer/draft.
export class SaveDraftDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsObject() data: Record<string, string>
}
