import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

// Body fields for POST /api/messages (multipart/form-data).
export class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(50) senderId: string
  @IsString() @MinLength(1) @MaxLength(50) recipientId: string
  @IsOptional() @IsString() @MaxLength(10000) body?: string
}

// Body of POST /api/messages/forms — a coordinator sends a Project Details
// Form to a loan applicant within their conversation.
export class SendFormDto {
  @IsString() @MinLength(1) @MaxLength(50) coordinatorId: string
  @IsString() @MinLength(1) @MaxLength(50) applicantId: string
}

// Body of PUT /api/messages/forms/:id — the applicant submits the filled form.
// `data` is the free-form { fieldName: value } map (same field set as the
// coordinator's Create Project form), so it isn't validated field-by-field here.
export class SubmitFormDto {
  @IsString() @MinLength(1) @MaxLength(50) userId: string
  @IsObject() data: Record<string, string>
}
