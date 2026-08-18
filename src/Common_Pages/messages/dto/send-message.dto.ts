//07
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

// Body fields for POST /api/messages (multipart/form-data).
export class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(50) recipientId: string
  @IsOptional() @IsString() @MaxLength(10000) body?: string
}
