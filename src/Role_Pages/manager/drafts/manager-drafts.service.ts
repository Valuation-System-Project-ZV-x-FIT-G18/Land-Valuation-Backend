import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'

type Row = Record<string, any>

// Review workflow states for a project's draft:
//  draft       -> being prepared / with L3 (not yet submitted)
//  pending_l2  -> L3 submitted, awaiting Manager L2 review
//  rejected_l3 -> L2 rejected, back to L3 to correct & resubmit
//  pending_l1  -> L2 approved, awaiting Manager L1 review
//  rejected_l2 -> L1 rejected, back to L2 to correct & resubmit
//  locked      -> L1 locked (final, uneditable; visible to the bank once paid)
@Injectable()
export class ManagerDraftsService {
  private readonly logger = new Logger(ManagerDraftsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}
}
