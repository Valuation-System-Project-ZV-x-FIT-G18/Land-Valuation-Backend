import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
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
export class ManagerDraftsService implements OnModuleInit {
  private readonly logger = new Logger(ManagerDraftsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.query(`CREATE TABLE IF NOT EXISTS drafts (
        id SERIAL PRIMARY KEY, project_id VARCHAR(20) NOT NULL UNIQUE,
        data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'draft'`)
      // Widen for longer statuses like 'rejected_to_coordinator' (23 chars).
      await this.db.query(`ALTER TABLE drafts ALTER COLUMN review_status TYPE VARCHAR(40)`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS reject_reason TEXT NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false`)
    } catch (err) {
      this.logger.error(`Manager drafts setup failed: ${(err as Error).message}`)
    }
  }
}
