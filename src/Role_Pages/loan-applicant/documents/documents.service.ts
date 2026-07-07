import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'

// Documents a loan applicant uploads for their valuation. One row per
// (applicant NIC, document type); re-uploading replaces the previous file.
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
    } catch (err) {
      this.logger.error(`Applicant documents setup failed: ${(err as Error).message}`)
    }
  }

  // The documents this applicant has uploaded so far.
  async list(nic: string) {
    const r = await this.db.query(
      `SELECT doc_type, file_name, status, created_at
         FROM applicant_documents WHERE applicant_nic = $1`,
      [nic.trim()],
    )
    return r.rows.map((d) => ({
      docType: d.doc_type as string,
      fileName: d.file_name as string,
      status: d.status as string,
      createdAt: d.created_at as string,
    }))
  }

  // Upload (or replace) one document.
  async upload(
    nic: string,
    docType: string,
    file?: { originalname: string; filename: string },
  ) {
    const n = (nic ?? '').trim()
    const t = (docType ?? '').trim()
    if (!n || !t || !file) return { ok: false, error: 'Missing details or file.' }

    await this.db.query(
      `INSERT INTO applicant_documents (applicant_nic, doc_type, file_name, file_path, status)
       VALUES ($1, $2, $3, $4, 'Submitted')
       ON CONFLICT (applicant_nic, doc_type)
       DO UPDATE SET file_name = EXCLUDED.file_name, file_path = EXCLUDED.file_path,
                     status = 'Submitted', created_at = now()`,
      [n, t, file.originalname, file.filename],
    )
    return { ok: true }
  }

  // Coordinator reviews a document: set its status (Approved / Resubmit) and
  // notify the applicant.
  async setStatus(nic: string, docType: string, status: string, label: string) {
    const n = (nic ?? '').trim()
    const t = (docType ?? '').trim()
    const s = (status ?? '').trim()
    if (!n || !t || !s) return { ok: false, error: 'Missing details.' }

    const r = await this.db.query(
      `UPDATE applicant_documents SET status = $3
        WHERE applicant_nic = $1 AND doc_type = $2`,
      [n, t, s],
    )
    if (!r.rowCount) return { ok: false, error: 'Document not found.' }

    await this.notifications.create(
      n,
      `Your document "${label || t}" was marked "${s}" by the coordinator.`,
    )
    return { ok: true }
  }

  // The stored file for a document (for download).
  async attachment(nic: string, docType: string) {
    const r = await this.db.query(
      `SELECT file_name, file_path FROM applicant_documents
        WHERE applicant_nic = $1 AND doc_type = $2`,
      [(nic ?? '').trim(), (docType ?? '').trim()],
    )
    const d = r.rows[0]
    if (!d || !d.file_path) return null
    return { fileName: d.file_name as string, filePath: d.file_path as string }
  }
}
