import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'

// Documents a loan applicant uploads for a valuation. One row per
// (applicant NIC, project, document type); re-uploading replaces the previous
// file. Scoped by project so an applicant with more than one project keeps a
// separate document set for each.
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly storage: ObjectStorageService,
  ) {}



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
    file?: Express.Multer.File,
  ) {
    const n = (nic ?? '').trim()
    const p = (projectId ?? '').trim()
    const t = (docType ?? '').trim()
    if (!n || !t || !file) return { ok: false, error: 'Missing details or file.' }

    const stored = await this.storage.store(file, `applicant-documents/${n}/${p}/${t}`)
    await this.db.query(
      `INSERT INTO applicant_documents (applicant_nic, project_id, doc_type, file_name, file_path, file_mime, file_data, object_key, status)
       VALUES ($1, $2, $3, $4, '', $5, $6, $7, 'Submitted')
       ON CONFLICT (applicant_nic, project_id, doc_type)
       DO UPDATE SET file_name = EXCLUDED.file_name, file_path = '', file_mime = EXCLUDED.file_mime, file_data = EXCLUDED.file_data, object_key = EXCLUDED.object_key,
                     status = 'Submitted', created_at = now()`,
      [n, p, t, file.originalname, file.mimetype, stored.databaseFallback, stored.objectKey],
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
      `SELECT file_name, file_mime, object_key FROM applicant_documents
        WHERE applicant_nic = $1 AND project_id = $2 AND doc_type = $3`,
      [(nic ?? '').trim(), (projectId ?? '').trim(), (docType ?? '').trim()],
    )
    const d = r.rows[0]
    if (!d?.object_key) return null
    const objectData = await this.storage.read(d.object_key as string)
    return { fileName: d.file_name as string, mime: d.file_mime as string, data: objectData }
  }
}
