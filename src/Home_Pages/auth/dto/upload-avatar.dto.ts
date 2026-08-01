import { IsString, MaxLength, MinLength } from 'class-validator'

// Body fields for POST /api/auth/avatar (multipart/form-data).
export class UploadAvatarDto {
  @IsString() @MinLength(1) @MaxLength(50) userId: string
}
