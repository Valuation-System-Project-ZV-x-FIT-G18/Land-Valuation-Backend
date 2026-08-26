import { IsIn } from 'class-validator'

export const ACCOUNT_STATUSES = ['Active', 'Suspended', 'Deactivated'] as const

export class UpdateUserStatusDto {
  @IsIn(ACCOUNT_STATUSES, { message: 'Choose a valid account status.' })
  status: (typeof ACCOUNT_STATUSES)[number]
}
