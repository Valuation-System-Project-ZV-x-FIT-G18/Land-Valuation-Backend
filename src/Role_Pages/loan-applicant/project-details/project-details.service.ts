import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'

type Row = Record<string, unknown>

@Injectable()
export class ProjectDetailsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectDetailsService.name)

  constructor(private readonly db: DatabaseService, private readonly storage: ObjectStorageService) {}

  async onModuleInit() {
    try {
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
      await this.db.query(`ALTER TABLE applicant_project_details ADD COLUMN IF NOT EXISTS id SERIAL`)
      await this.db.query(`ALTER TABLE applicant_project_details ADD COLUMN IF NOT EXISTS label VARCHAR(100) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE applicant_project_details ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Pending'`)
      await this.db.query(`ALTER TABLE applicant_project_details ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`)
      await this.db.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.conrelid = 'applicant_project_details'::regclass
              AND c.contype = 'p' AND a.attname = 'id'
          ) THEN
            ALTER TABLE applicant_project_details DROP CONSTRAINT IF EXISTS applicant_project_details_pkey CASCADE;
            ALTER TABLE applicant_project_details ADD CONSTRAINT applicant_project_details_pkey PRIMARY KEY (id);
          END IF;
        END $$`)
      await this.db.query(`CREATE INDEX IF NOT EXISTS applicant_project_details_nic_idx ON applicant_project_details (applicant_nic)`)
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS applicant_project_detail_files (
           id         SERIAL       PRIMARY KEY,
           draft_id   INTEGER      NOT NULL REFERENCES applicant_project_details(id) ON DELETE CASCADE,
           doc_type   VARCHAR(60)  NOT NULL,
           file_name  VARCHAR(255) NOT NULL DEFAULT '',
           file_path  VARCHAR(255) NOT NULL DEFAULT '',
           file_mime  VARCHAR(100) NOT NULL DEFAULT '',
           file_data  BYTEA,
           object_key VARCHAR(1024) NOT NULL DEFAULT '',
           created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
           UNIQUE (draft_id, doc_type)
         )`,
      )
      await this.db.query(`ALTER TABLE applicant_project_detail_files ADD COLUMN IF NOT EXISTS file_mime VARCHAR(100) NOT NULL DEFAULT ''`)
      await this.db.query(`ALTER TABLE applicant_project_detail_files ADD COLUMN IF NOT EXISTS file_data BYTEA`)
      await this.db.query(`ALTER TABLE applicant_project_detail_files ADD COLUMN IF NOT EXISTS object_key VARCHAR(1024) NOT NULL DEFAULT ''`)
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
        WHERE draft_id = ANY($1)
          AND (object_key <> '' OR file_data IS NOT NULL OR file_path <> '')`,
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

  async remove(id: number, nic: string) {
    if (!Number.isInteger(id)) return { ok: false, error: 'Draft not found.' }
    const r = await this.db.query(
      `DELETE FROM applicant_project_details WHERE id = $1 AND applicant_nic = $2`,
      [id, (nic ?? '').trim()],
    )
    if (!r.rowCount) return { ok: false, error: 'Draft not found.' }
    return { ok: true }
  }

  async saveFile(draftId: number, nic: string, docType: string, file?: Express.Multer.File) {
    const t = (docType ?? '').trim()
    if (!Number.isInteger(draftId) || !t || !file) return { ok: false, error: 'Missing details or file.' }
    if (!file.buffer?.length) {
      return { ok: false, error: 'The file content was not received. Please upload the file again.' }
    }

    const owns = await this.db.query(
      `SELECT 1 FROM applicant_project_details WHERE id = $1 AND applicant_nic = $2`,
      [draftId, (nic ?? '').trim()],
    )
    if (!owns.rows[0]) return { ok: false, error: 'Draft not found.' }

    const stored = await this.storage.store(file, `applicant-project-drafts/${draftId}/${t}`)
    await this.db.query(
      `INSERT INTO applicant_project_detail_files (draft_id, doc_type, file_name, file_path, file_mime, file_data, object_key)
       VALUES ($1, $2, $3, '', $4, $5, $6)
       ON CONFLICT (draft_id, doc_type)
       DO UPDATE SET file_name = EXCLUDED.file_name, file_path = '',
                     file_mime = EXCLUDED.file_mime, file_data = EXCLUDED.file_data,
                     object_key = EXCLUDED.object_key, created_at = now()`,
      [draftId, t, file.originalname, file.mimetype ?? '', stored.databaseFallback ?? file.buffer, stored.objectKey],
    )
    return { ok: true }
  }

  async attachment(draftId: number, docType: string) {
    if (!Number.isInteger(draftId)) return null
    const r = await this.db.query(
      `SELECT file_name, file_path, file_mime, file_data, object_key
         FROM applicant_project_detail_files
        WHERE draft_id = $1 AND doc_type = $2`,
      [draftId, (docType ?? '').trim()],
    )
    const f = r.rows[0]
    if (!f || (!f.object_key && !f.file_data && !f.file_path)) return null
    const objectData = await this.storage.read(f.object_key as string)
    return {
      fileName: f.file_name as string,
      filePath: (f.file_path as string) || '',
      mime: (f.file_mime as string) || 'application/octet-stream',
      data: objectData ?? (f.file_data as Buffer | null) ?? null,
    }
  }

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
