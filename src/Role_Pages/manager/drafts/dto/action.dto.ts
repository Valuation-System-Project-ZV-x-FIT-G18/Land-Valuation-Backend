import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export const REVIEW_STATUSES = [
  'pending_l3', 'pending_l2', 'pending_l1',
  'rejected_l3', 'rejected_l2', 'rejected_to_to',
  'locked',
] as const

// Body of POST /api/manager/drafts/action.
export class DraftActionDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsOptional() @IsString() reportHtml?: string
  @IsIn(REVIEW_STATUSES, { message: 'Invalid review status.' }) status: string
  @IsOptional() @IsString() @MaxLength(1000) reason?: string
}
