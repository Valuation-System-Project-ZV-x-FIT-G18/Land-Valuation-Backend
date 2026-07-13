import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

// Body fields for POST /api/technical-officer/site-photos (multipart/form-data).
export class UploadSitePhotoDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsString() @MinLength(1) @MaxLength(20) toId: string
  @IsString() @MinLength(1) @MaxLength(60) photoType: string
  @IsOptional() @IsString() @MaxLength(10) describe?: string
  @IsOptional() @IsString() @MaxLength(100) photoLabel?: string
}
