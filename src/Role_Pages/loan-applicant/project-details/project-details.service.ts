import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'

type Row = Record<string, unknown>

// An applicant can have more than one project (e.g. two separate lands), so
// they keep a LIST of drafts here — not just one. Each draft holds the same
// field set as the coordinator's Create Project form (minus document
// uploads). The coordinator picks which draft (if any) to start a new
// project from; picking one doesn't lock it — it's only marked "Used" once
// that project is actually created, so the same draft never gets silently
// reused for an unrelated second project.
@Injectable()
export class ProjectDetailsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectDetailsService.name)

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    try {
      // Fresh install: create with the current (list) shape directly.
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS applicant_project_details (
           id             SERIAL       PRIMARY KEY,
           applicant_nic  VARCHAR(20)  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
           label          VARCHAR(100) NOT NULL DEFAULT '',
           status         VARCHAR(20)  NOT NULL DEFAULT 'Pending',
           data           JSONB        NOT NULL DEFAULT '{}'::jsonb,
           created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
           updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
         )`,
      )
      // Migration: an earlier version of this table had applicant_nic as the
      // PRIMARY KEY (one draft per applicant). Move to a proper id PK so an
      // applicant can have several drafts; safe/idempotent to re-run.
      await this.db.query(`ALTER TABLE applicant_project_details ADD COLUMN IF NOT EXISTS id SERIAL`)
      await this.db.query(`ALTER TABLE applicant_project_details ADD COLUMN IF NOT EXISTS label VARCHAR(100) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE applicant_project_details ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Pending'`)
      await this.db.query(`ALTER TABLE applicant_project_details ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`)
      await this.db.query(`ALTER TABLE applicant_project_details DROP CONSTRAINT IF EXISTS applicant_project_details_pkey`)
      await this.db.query(`ALTER TABLE applicant_project_details ADD CONSTRAINT applicant_project_details_pkey PRIMARY KEY (id)`)
      await this.db.query(
        `CREATE INDEX IF NOT EXISTS applicant_project_details_nic_idx ON applicant_project_details (applicant_nic)`,
      )

      // Documents attached to a draft (the same upload slots as the
      // coordinator's Create Project form — survey plan, title deed, etc.).
      // One file per (draft, doc type); re-uploading replaces it.
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS applicant_project_detail_files (
           id         SERIAL       PRIMARY KEY,
           draft_id   INTEGER      NOT NULL REFERENCES applicant_project_details(id) ON DELETE CASCADE,
           doc_type   VARCHAR(60)  NOT NULL,
           file_name  VARCHAR(255) NOT NULL DEFAULT '',
           file_path  VARCHAR(255) NOT NULL DEFAULT '',
           created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
           UNIQUE (draft_id, doc_type)
         )`,
      )
    } catch (err) {
      this.logger.error(`Applicant project details setup failed: ${(err as Error).message}`)
    }
  }

  private toDraft(r: Row) {
    return {
      id: Number(r.id),
      label: (r.label as string) ?? '',
      status: (r.status as string) || 'Pending',
      data: (r.data as Record<string, string>) ?? {},
      updatedAt: r.updated_at as string,
    }
  }

  // All of this applicant's drafts (each with its attached documents), newest
  // first — used both by their own Fill Form list and the coordinator's
  // picker for that NIC.
  async list(nic: string) {
    const n = (nic ?? '').trim()
    if (!n) return []
    const r = await this.db.query(
      `SELECT id, label, status, data, updated_at
         FROM applicant_project_details
        WHERE applicant_nic = $1
        ORDER BY updated_at DESC`,
      [n],
    )
    const drafts = r.rows.map((row) => this.toDraft(row))
    if (!drafts.length) return drafts

    const f = await this.db.query(
      `SELECT draft_id, doc_type, file_name FROM applicant_project_detail_files
        WHERE draft_id = ANY($1)`,
      [drafts.map((d) => d.id)],
    )
    const byDraft = new Map<number, { docType: string; fileName: string }[]>()
    for (const row of f.rows) {
      const list = byDraft.get(Number(row.draft_id)) ?? []
      list.push({ docType: row.doc_type as string, fileName: row.file_name as string })
      byDraft.set(Number(row.draft_id), list)
    }
    return drafts.map((d) => ({ ...d, files: byDraft.get(d.id) ?? [] }))
  }

  // Save a new draft.
  async create(nic: string, label: string, data: Record<string, string>) {
    const n = (nic ?? '').trim()
    if (!n) return { ok: false, error: 'Missing NIC.' }
    const exists = await this.db.query(`SELECT 1 FROM users WHERE user_id = $1 AND role = 'Loan Applicant'`, [n])
    if (!exists.rows[0]) return { ok: false, error: 'Applicant not found.' }

    const r = await this.db.query(
      `INSERT INTO applicant_project_details (applicant_nic, label, data)
       VALUES ($1, $2, $3) RETURNING id`,
      [n, (label ?? '').trim(), JSON.stringify(data ?? {})],
    )
    return { ok: true, id: Number(r.rows[0].id) }
  }

  // Update an existing draft — only its own applicant may edit it.
  async update(id: number, nic: string, label: string, data: Record<string, string>) {
    if (!Number.isInteger(id)) return { ok: false, error: 'Draft not found.' }
    const r = await this.db.query(
      `UPDATE applicant_project_details SET label = $1, data = $2, updated_at = now()
        WHERE id = $3 AND applicant_nic = $4`,
      [(label ?? '').trim(), JSON.stringify(data ?? {}), id, (nic ?? '').trim()],
    )
    if (!r.rowCount) return { ok: false, error: 'Draft not found.' }
    return { ok: true }
  }

  // Delete a draft — only its own applicant may remove it.
  async remove(id: number, nic: string) {
    if (!Number.isInteger(id)) return { ok: false, error: 'Draft not found.' }
    const r = await this.db.query(
      `DELETE FROM applicant_project_details WHERE id = $1 AND applicant_nic = $2`,
      [id, (nic ?? '').trim()],
    )
    if (!r.rowCount) return { ok: false, error: 'Draft not found.' }
    return { ok: true }
  }

  // Called once a project has actually been created from this draft, so it
  // doesn't silently get reused/auto-picked for a later, unrelated project.
  async markUsed(id: number) {
    if (!Number.isInteger(id)) return { ok: false, error: 'Draft not found.' }
    const r = await this.db.query(
      `UPDATE applicant_project_details SET status = 'Used', updated_at = now() WHERE id = $1`,
      [id],
    )
    if (!r.rowCount) return { ok: false, error: 'Draft not found.' }
    return { ok: true }
  }
}
