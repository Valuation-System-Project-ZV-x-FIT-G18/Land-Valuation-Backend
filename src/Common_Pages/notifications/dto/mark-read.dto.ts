import { IsString, MaxLength, MinLength } from 'class-validator'

// Body of POST /api/notifications/read.
export class MarkReadDto {
  @IsString() @MinLength(1) @MaxLength(50) userId: string
}
