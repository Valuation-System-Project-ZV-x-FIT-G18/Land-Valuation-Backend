import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'

// A loan applicant's own draft of the project detail fields (same field set
// as the coordinator's Create Project form, minus document uploads). Filled
// in via the "Fill Form" sidebar page; the coordinator's Create Project form
// auto-fills from it once the applicant's NIC is confirmed there — still
// fully editable by the coordinator before they actually create the project.
@Injectable()
export class ProjectDetailsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectDetailsService.name)

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    try {
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS applicant_project_details (
           applicant_nic VARCHAR(20)  PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
           data          JSONB        NOT NULL DEFAULT '{}'::jsonb,
           updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
         )`,
      )
    } catch (err) {
      this.logger.error(`Applicant project details setup failed: ${(err as Error).message}`)
    }
  }

  // The applicant's saved draft, if any.
  async get(nic: string) {
    const n = (nic ?? '').trim()
    if (!n) return null
    const r = await this.db.query(
      `SELECT data, updated_at FROM applicant_project_details WHERE applicant_nic = $1`,
      [n],
    )
    const row = r.rows[0]
    if (!row) return null
    return { data: (row.data as Record<string, string>) ?? {}, updatedAt: row.updated_at as string }
  }

  // Save (create or replace) the applicant's draft.
  async save(nic: string, data: Record<string, string>) {
    const n = (nic ?? '').trim()
    if (!n) return { ok: false, error: 'Missing NIC.' }
    const exists = await this.db.query(`SELECT 1 FROM users WHERE user_id = $1 AND role = 'Loan Applicant'`, [n])
    if (!exists.rows[0]) return { ok: false, error: 'Applicant not found.' }

    await this.db.query(
      `INSERT INTO applicant_project_details (applicant_nic, data, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (applicant_nic) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [n, JSON.stringify(data ?? {})],
    )
    return { ok: true }
  }
}
