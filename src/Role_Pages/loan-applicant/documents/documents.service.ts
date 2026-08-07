import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'

// Documents a loan applicant uploads for a valuation. One row per
// (applicant NIC, project, document type); re-uploading replaces the previous
// file. Scoped by project so an applicant with more than one project keeps a
// separate document set for each.
@Injectable()
export class DocumentsService implements OnModuleInit {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS applicant_documents (
           id            SERIAL PRIMARY KEY,
           applicant_nic VARCHAR(20)  NOT NULL,
           doc_type      VARCHAR(60)  NOT NULL,
           file_name     VARCHAR(255) NOT NULL DEFAULT '',
           file_path     VARCHAR(255) NOT NULL DEFAULT '',
           status        VARCHAR(30)  NOT NULL DEFAULT 'Submitted',
           created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
           UNIQUE (applicant_nic, doc_type)
         )`,
      )
      await this.db.query(`ALTER TABLE applicant_documents ADD COLUMN IF NOT EXISTS project_id VARCHAR(20) NOT NULL DEFAULT ''`)
      // Existing rows predate per-project documents — attach them to that
      // applicant's earliest project so nothing already uploaded is lost.
      await this.db.query(
        `UPDATE applicant_documents ad SET project_id = COALESCE((
           SELECT project_id FROM projects WHERE applicant_nic = ad.applicant_nic
            ORDER BY created_at ASC LIMIT 1), '')
          WHERE ad.project_id = ''`,
      )
      // The old (applicant_nic, doc_type) constraint would block two projects
      // having the same document type — replace it with a per-project one.
      await this.db.query(
        `ALTER TABLE applicant_documents DROP CONSTRAINT IF EXISTS applicant_documents_applicant_nic_doc_type_key`,
      )
      await this.db.query(
        `ALTER TABLE applicant_documents ADD CONSTRAINT applicant_documents_nic_project_doc_key
           UNIQUE (applicant_nic, project_id, doc_type)`,
      )
    } catch (err) {
      this.logger.error(`Applicant documents setup failed: ${(err as Error).message}`)
    }
  }

  // The documents this applicant has uploaded so far for one project.
  async list(nic: string, projectId: string) {
    const r = await this.db.query(
      `SELECT doc_type, file_name, status, created_at
         FROM applicant_documents WHERE applicant_nic = $1 AND project_id = $2`,
      [nic.trim(), (projectId ?? '').trim()],
    )
    return r.rows.map((d) => ({
      docType: d.doc_type as string,
      fileName: d.file_name as string,
      status: d.status as string,
      createdAt: d.created_at as string,
    }))
  }

  // Upload (or replace) one document. `projectId` may be blank — that's the
  // "general" bucket used before a coordinator has created a project for
  // this applicant yet (right after registration).
  async upload(
    nic: string,
    projectId: string,
    docType: string,
    file?: { originalname: string; filename: string },
  ) {
    const n = (nic ?? '').trim()
    const p = (projectId ?? '').trim()
    const t = (docType ?? '').trim()
    if (!n || !t || !file) return { ok: false, error: 'Missing details or file.' }

    await this.db.query(
      `INSERT INTO applicant_documents (applicant_nic, project_id, doc_type, file_name, file_path, status)
       VALUES ($1, $2, $3, $4, $5, 'Submitted')
       ON CONFLICT (applicant_nic, project_id, doc_type)
       DO UPDATE SET file_name = EXCLUDED.file_name, file_path = EXCLUDED.file_path,
                     status = 'Submitted', created_at = now()`,
      [n, p, t, file.originalname, file.filename],
    )
    return { ok: true }
  }

  // Coordinator reviews a document: set its status (Approved / Resubmit) and
  // notify the applicant.
  async setStatus(nic: string, projectId: string, docType: string, status: string, label: string) {
    const n = (nic ?? '').trim()
    const p = (projectId ?? '').trim()
    const t = (docType ?? '').trim()
    const s = (status ?? '').trim()
    if (!n || !t || !s) return { ok: false, error: 'Missing details.' }

    const r = await this.db.query(
      `UPDATE applicant_documents SET status = $4
        WHERE applicant_nic = $1 AND project_id = $2 AND doc_type = $3`,
      [n, p, t, s],
    )
    if (!r.rowCount) return { ok: false, error: 'Document not found.' }

    const forProject = p ? ` for project ${p}` : ''
    await this.notifications.create(
      n,
      `Your document "${label || t}"${forProject} was marked "${s}" by the coordinator.`,
    )
    return { ok: true }
  }

  // The stored file for a document (for download).
  async attachment(nic: string, projectId: string, docType: string) {
    const r = await this.db.query(
      `SELECT file_name, file_path FROM applicant_documents
        WHERE applicant_nic = $1 AND project_id = $2 AND doc_type = $3`,
      [(nic ?? '').trim(), (projectId ?? '').trim(), (docType ?? '').trim()],
    )
    const d = r.rows[0]
    if (!d || !d.file_path) return null
    return { fileName: d.file_name as string, filePath: d.file_path as string }
  }
}
