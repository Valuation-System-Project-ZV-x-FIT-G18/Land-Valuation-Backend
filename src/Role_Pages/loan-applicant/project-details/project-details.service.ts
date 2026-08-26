import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'

type Row = Record<string, unknown>

// An applicant can have more than one project (e.g. two separate lands), so
// they keep a LIST of drafts here — not just one. Each draft holds the same
// field set as the coordinator's Create Project form (minus document
// uploads). The coordinator picks which draft (if any) to start a new
// project from; picking one doesn't lock it — it's only marked "Used" once
// that project is actually created, so the same draft never gets silently
// reused for an unrelated second project.
@Injectable()
export class ProjectDetailsService {
  private readonly logger = new Logger(ProjectDetailsService.name)

  constructor(private readonly db: DatabaseService, private readonly storage: ObjectStorageService) {}



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

  // Attach (or replace) one document on a draft. Only the draft's own
  // applicant may upload to it.
  async saveFile(
    draftId: number,
    nic: string,
    docType: string,
    file?: Express.Multer.File,
  ) {
    const t = (docType ?? '').trim()
    if (!Number.isInteger(draftId) || !t || !file) return { ok: false, error: 'Missing details or file.' }

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
       DO UPDATE SET file_name = EXCLUDED.file_name, file_path = '', file_mime = EXCLUDED.file_mime, file_data = EXCLUDED.file_data, object_key = EXCLUDED.object_key,
                     created_at = now()`,
      [draftId, t, file.originalname, file.mimetype, stored.databaseFallback, stored.objectKey],
    )
    return { ok: true }
  }

  // The stored file for one of a draft's documents (for download by the
  // applicant or the coordinator reviewing it).
  async attachment(draftId: number, docType: string, applicantNic: string) {
    if (!Number.isInteger(draftId)) return null
    const r = await this.db.query(
      `SELECT f.file_name, f.file_mime, f.object_key
         FROM applicant_project_detail_files f
         JOIN applicant_project_details d ON d.id = f.draft_id
        WHERE f.draft_id = $1 AND f.doc_type = $2 AND d.applicant_nic = $3`,
      [draftId, (docType ?? '').trim(), applicantNic.trim()],
    )
    const f = r.rows[0]
    if (!f?.object_key) return null
    const objectData = await this.storage.read(f.object_key as string)
    return { fileName: f.file_name as string, mime: f.file_mime as string, data: objectData }
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
