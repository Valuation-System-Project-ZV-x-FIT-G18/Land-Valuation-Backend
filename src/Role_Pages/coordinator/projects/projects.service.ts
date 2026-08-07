import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import { projectFieldColumns } from './constants/project-fields'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'

type Body = { applicantNic?: string; coordinatorId?: string; data?: string }
type Files = Record<string, Express.Multer.File[]>

// Creates a land valuation project. Every form field is stored in its own column
// (see project-fields.ts) for clear, queryable data; the full JSON is also kept
// in the `details` column as a backup. Uploaded files go to project_files.
@Injectable()
export class ProjectsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly storage: ObjectStorageService,
  ) {}

  // Make sure every form field has its own column (safe to run repeatedly).
  async onModuleInit() {
    for (const { column } of projectFieldColumns) {
      try {
        await this.db.query(
          `ALTER TABLE projects ADD COLUMN IF NOT EXISTS "${column}" TEXT NOT NULL DEFAULT ''`,
        )
      } catch (err) {
        this.logger.error(`Could not ensure column ${column}: ${(err as Error).message}`)
      }
    }
    try {
      await this.db.query(`ALTER TABLE project_files ADD COLUMN IF NOT EXISTS file_data BYTEA`)
      await this.db.query(`ALTER TABLE project_files ADD COLUMN IF NOT EXISTS object_key VARCHAR(1024) NOT NULL DEFAULT ''`)
    } catch (err) {
      this.logger.error(`Could not ensure project file storage: ${(err as Error).message}`)
    }
  }

  // Find the most recent project for a given project id OR applicant NIC.
  async findByNicOrId(q: string) {
    const v = q.trim()
    if (!v) return null
    const r = await this.db.query(
      `SELECT project_id, applicant_nic
         FROM projects
        WHERE project_id = $1 OR applicant_nic = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [v],
    )
    const row = r.rows[0]
    if (!row) return null
    return { projectId: row.project_id as string, nic: row.applicant_nic as string }
  }

  // List projects for the Project Status page. With a query, returns every
  // project for that NIC or the one matching Project ID; without, the latest 100.
  async listStatus(q: string) {
    const v = (q ?? '').trim()
    const cols = `p.project_id, p.applicant_nic, p.property_type, p.status, p.created_at,
                  COALESCE(d.paid, false) AS paid`
    const sql = v
      ? `SELECT ${cols}
           FROM projects p LEFT JOIN drafts d ON d.project_id = p.project_id
          WHERE p.project_id = $1 OR p.applicant_nic = $1
          ORDER BY p.created_at DESC`
      : `SELECT ${cols}
           FROM projects p LEFT JOIN drafts d ON d.project_id = p.project_id
          ORDER BY p.created_at DESC
          LIMIT 100`
    const r = await this.db.query(sql, v ? [v] : [])
    return r.rows.map((row) => ({
      projectId: row.project_id as string,
      nic: row.applicant_nic as string,
      propertyType: row.property_type as string,
      // Once the fee is paid the valuation is complete — reflect that reliably
      // even if the stored status column wasn't updated at payment time.
      status: row.paid ? 'Valuation Completed' : (row.status as string),
      createdAt: row.created_at as string,
    }))
  }

  async create(body: Body, files: Files) {
    const detailsJson = body.data || '{}'
    let details: Record<string, unknown> = {}
    try {
      details = JSON.parse(detailsJson)
    } catch {
      details = {}
    }

    const nic = (body.applicantNic ?? '').trim()

    // Build one INSERT: applicant NIC, the JSON backup, the lifecycle status,
    // then every field column. project_id (e.g. 'pro001') comes from the default.
    // The applicant was registered before this, so the project starts at the
    // 'Project Created' stage of the lifecycle timeline.
    const columns = ['applicant_nic', 'details', 'status', ...projectFieldColumns.map((f) => f.column)]
    const params: unknown[] = [
      nic,
      detailsJson,
      'Project Created',
      ...projectFieldColumns.map((f) => String(details[f.key] ?? '')),
    ]
    const placeholders = columns.map((c, i) =>
      c === 'details' ? `$${i + 1}::jsonb` : `$${i + 1}`,
    )

    const result = await this.db.query(
      `INSERT INTO projects (${columns.map((c) => `"${c}"`).join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING project_id`,
      params,
    )
    const projectId = result.rows[0].project_id as string

    // Save one row per uploaded document/photo. memoryStorage supplies the
    // complete bytes in `buffer`, which are persisted directly in PostgreSQL.
    for (const [fieldName, list] of Object.entries(files ?? {})) {
      for (const f of list) {
        const stored = await this.storage.store(f, `projects/${projectId}/${fieldName}`)
        const saved = await this.db.query(
          `INSERT INTO project_files
             (project_id, file_type, file_name, file_path, mime, size, file_data, object_key)
           VALUES ($1, $2, $3, '', $4, $5, $6, $7)
           RETURNING octet_length(file_data) AS stored_bytes`,
          [projectId, fieldName, f.originalname, f.mimetype, f.size, stored.databaseFallback, stored.objectKey],
        )
        if (!stored.objectKey && Number(saved.rows[0]?.stored_bytes ?? 0) !== f.size) {
          throw new Error(`Document "${f.originalname}" was not stored completely.`)
        }
      }
    }

    // Notify the loan applicant and the requesting bank that it was created.
    await this.notifyProjectCreated(
      projectId,
      nic,
      String(details.ownerNameAsPerDeed ?? ''),
      String(details.bankEmail ?? '').trim(),
    )

    // In-system notification to the coordinator who created it.
    const coordinatorId = (body.coordinatorId ?? '').trim()
    if (coordinatorId) {
      await this.notifications.create(
        coordinatorId,
        `Project ${projectId} created for ${String(details.ownerNameAsPerDeed ?? 'the applicant')} (NIC ${nic}).`,
      )
    }

    return projectId
  }

  // Email + in-system notify the loan applicant (address stored with their
  // account) and the requesting bank (address entered on the form). Never
  // blocks project creation.
  private async notifyProjectCreated(
    projectId: string,
    nic: string,
    ownerName: string,
    bankEmail: string,
  ) {
    let applicantEmail = ''
    try {
      const r = await this.db.query(
        `SELECT email FROM users WHERE nic = $1 AND role = 'Loan Applicant' LIMIT 1`,
        [nic],
      )
      applicantEmail = (r.rows[0]?.email as string) ?? ''
    } catch (err) {
      this.logger.error(`Could not look up applicant email: ${(err as Error).message}`)
    }

    if (applicantEmail) {
      await this.mail.sendProjectCreated(applicantEmail, {
        projectId, nic, ownerName, audience: 'applicant',
      })
    }
    await this.notifications.create(
      nic,
      `Your land valuation project ${projectId} has been created and is now being processed.`,
    )

    if (bankEmail) {
      await this.mail.sendProjectCreated(bankEmail, {
        projectId, nic, ownerName, audience: 'bank',
      })
      // Best-effort in-system notice, only if this address belongs to a
      // registered bank login (its user_id is the branch code).
      const bankUserId = await this.notifications.resolveBankUserId(bankEmail)
      if (bankUserId) {
        await this.notifications.create(
          bankUserId,
          `A new valuation project (${projectId}) has been created for the application you referred (NIC ${nic}).`,
        )
      }
    }
  }

  // Full stored details of a project + the list of uploaded documents.
  async details(projectId: string) {
    const p = (projectId ?? '').trim()
    const pr = await this.db.query(`SELECT applicant_nic, status, details, created_at FROM projects WHERE project_id = $1`, [p])
    const row = pr.rows[0]
    if (!row) return null
    const files = await this.db.query(
      `SELECT DISTINCT ON (file_type) file_type, file_name FROM project_files
        WHERE project_id = $1 ORDER BY file_type, id DESC`,
      [p],
    )
    return {
      projectId: p,
      applicantNic: row.applicant_nic as string,
      status: row.status as string,
      createdAt: row.created_at as string,
      details: (row.details ?? {}) as Record<string, string>,
      documents: files.rows.map((f) => ({ type: f.file_type as string, fileName: f.file_name as string })),
    }
  }

  // The latest uploaded file of a given type for a project (e.g. surveyPlan).
  async fileAttachment(projectId: string, fileType: string) {
    const r = await this.db.query(
      `SELECT file_name, file_path, mime, file_data, object_key FROM project_files
        WHERE project_id = $1 AND file_type = $2 ORDER BY id DESC LIMIT 1`,
      [(projectId ?? '').trim(), (fileType ?? '').trim()],
    )
    const p = r.rows[0]
    if (!p || (!p.object_key && !p.file_data && !p.file_path)) return null
    const objectData = await this.storage.read(p.object_key as string)
    return {
      fileName: p.file_name as string,
      filePath: (p.file_path as string) || '',
      mime: (p.mime as string) || 'application/octet-stream',
      data: objectData ?? (p.file_data as Buffer | null) ?? null,
    }
  }
}
