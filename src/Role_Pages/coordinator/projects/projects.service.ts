import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'
import { projectFieldColumns } from './constants/project-fields'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

type Body = {
  applicantNic?: string
  coordinatorId?: string
  sourceDraftId?: string
  sourceDraftFileTypes?: string
  data?: string
}
type Files = Record<string, Express.Multer.File[]>

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly storage: ObjectStorageService,
  ) {}



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

  async listStatus(user: AuthUser, q: string) {
    const v = (q ?? '').trim()
    const cols = `p.project_id, p.applicant_nic, p.property_type, p.status, p.created_at,
                  p.village_town, p.property_city, p.district,
                  applicant.first_name, applicant.last_name,
                  latest.status AS valuation_status, latest.technical_officer_id,
                  COALESCE(d.paid, false) AS paid,
                  (SELECT COUNT(*)::int FROM valuations v WHERE v.project_id = p.project_id) AS valuation_count`
    const params: string[] = []
    let access = 'true'
    if (user.role === 'Loan Applicant') {
      params.push(user.userId)
      access = `p.applicant_nic = $${params.length}`
    } else if (user.role === 'Bank') {
      params.push(user.userId)
      access = `EXISTS (SELECT 1 FROM valuations linked
        WHERE linked.project_id = p.project_id
          AND linked.details->>'bankBranchCode' = $${params.length})`
    }
    let search = ''
    let ranking = 'p.created_at DESC'
    let limit = 'LIMIT 100'
    if (v) {
      params.push(`%${v}%`)
      const containsIndex = params.length
      params.push(v)
      const exactIndex = params.length
      params.push(`${v}%`)
      const prefixIndex = params.length
      search = `AND (p.project_id ILIKE $${containsIndex} OR p.applicant_nic ILIKE $${containsIndex})`
      ranking = `CASE
        WHEN LOWER(p.project_id) = LOWER($${exactIndex}) OR p.applicant_nic = $${exactIndex} THEN 0
        WHEN p.project_id ILIKE $${prefixIndex} THEN 1
        WHEN p.applicant_nic ILIKE $${prefixIndex} THEN 2
        ELSE 3 END, p.created_at DESC`
      limit = 'LIMIT 20'
    }
    const r = await this.db.query(
      `SELECT ${cols} FROM projects p
        LEFT JOIN drafts d ON d.project_id = p.project_id
        LEFT JOIN users applicant ON applicant.user_id = p.applicant_nic
        LEFT JOIN LATERAL (
          SELECT status, technical_officer_id FROM valuations
           WHERE project_id = p.project_id ORDER BY valuation_id DESC, id DESC LIMIT 1
        ) latest ON true
        WHERE ${access} ${search} ORDER BY ${ranking} ${limit}`,
      params,
    )
    return r.rows.map((row) => ({
      projectId: row.project_id as string,
      nic: row.applicant_nic as string,
      propertyType: row.property_type as string,
      status: row.paid ? 'Valuation Completed' : (row.status as string),
      createdAt: row.created_at as string,
      valuationCount: Number(row.valuation_count ?? 0),
      applicantName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
      location: [row.village_town, row.property_city, row.district].filter(Boolean).join(', '),
      valuationStatus: (row.valuation_status as string) || '',
      technicalOfficerId: (row.technical_officer_id as string) || '',
    }))
  }

  async dashboardStatus() {
    const result = await this.db.query(
      `SELECT p.project_id, p.applicant_nic, p.property_type, p.status, p.created_at,
              p.village_town, p.property_city, p.district,
              applicant.first_name, applicant.last_name,
              latest.status AS valuation_status, latest.technical_officer_id,
              COALESCE(d.paid, false) AS paid,
              (SELECT COUNT(*)::int FROM valuations v WHERE v.project_id = p.project_id) AS valuation_count
         FROM projects p
         LEFT JOIN drafts d ON d.project_id = p.project_id
         LEFT JOIN users applicant ON applicant.user_id = p.applicant_nic
         LEFT JOIN LATERAL (
           SELECT status, technical_officer_id FROM valuations
            WHERE project_id = p.project_id ORDER BY valuation_id DESC, id DESC LIMIT 1
         ) latest ON true
        ORDER BY p.created_at DESC`,
    )
    return result.rows.map((row) => ({
      projectId: row.project_id as string,
      nic: row.applicant_nic as string,
      propertyType: row.property_type as string,
      status: row.paid ? 'Valuation Completed' : (row.status as string),
      createdAt: row.created_at as string,
      valuationCount: Number(row.valuation_count ?? 0),
      applicantName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
      location: [row.village_town, row.property_city, row.district].filter(Boolean).join(', '),
      valuationStatus: (row.valuation_status as string) || '',
      technicalOfficerId: (row.technical_officer_id as string) || '',
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
    const columns = ['applicant_nic', 'details', 'status', ...projectFieldColumns.map((f) => f.column)]
    const params: unknown[] = [
      nic,
      detailsJson,
      'Project Created',
      ...projectFieldColumns.map((f) => String(details[f.key] ?? '')),
    ]
    const placeholders = columns.map((c, i) => (c === 'details' ? `$${i + 1}::jsonb` : `$${i + 1}`))

    const result = await this.db.query(
      `INSERT INTO projects (${columns.map((c) => `"${c}"`).join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING project_id`,
      params,
    )
    const projectId = result.rows[0].project_id as string

    const uploadedTypes = new Set<string>()
    for (const [fieldName, list] of Object.entries(files ?? {})) {
      for (const f of list) {
        if (!f.buffer?.length) throw new Error(`Document "${f.originalname}" was not received completely.`)
        uploadedTypes.add(fieldName)
        const stored = await this.storage.store(f, `projects/${projectId}/${fieldName}`)
        await this.db.query(
          `INSERT INTO project_files
             (project_id, file_type, file_name, file_path, mime, size, file_data, object_key)
           VALUES ($1, $2, $3, '', $4, $5, $6, $7)`,
          [projectId, fieldName, f.originalname, f.mimetype, f.size, stored.databaseFallback ?? f.buffer, stored.objectKey],
        )
      }
    }

    const sourceDraftId = Number(body.sourceDraftId)
    let sourceTypes: string[] = []
    try {
      sourceTypes = JSON.parse(body.sourceDraftFileTypes || '[]')
    } catch {
      sourceTypes = []
    }
    sourceTypes = sourceTypes.map((t) => String(t ?? '').trim()).filter((t) => t && !uploadedTypes.has(t))

    if (Number.isInteger(sourceDraftId) && sourceTypes.length) {
      const copied = await this.db.query(
        `SELECT f.doc_type, f.file_name, f.file_path, f.file_mime, f.file_data, f.object_key
           FROM applicant_project_detail_files f
           JOIN applicant_project_details d ON d.id = f.draft_id
          WHERE f.draft_id = $1
            AND d.applicant_nic = $2
            AND f.doc_type = ANY($3)
            AND (f.object_key <> '' OR f.file_data IS NOT NULL OR f.file_path <> '')`,
        [sourceDraftId, nic, sourceTypes],
      )
      for (const f of copied.rows) {
        await this.db.query(
          `INSERT INTO project_files (project_id, file_type, file_name, file_path, mime, size, file_data, object_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            projectId,
            f.doc_type,
            f.file_name,
            f.file_path ?? '',
            f.file_mime ?? '',
            f.file_data ? Buffer.byteLength(f.file_data as Buffer) : 0,
            f.file_data ?? null,
            f.object_key ?? '',
          ],
        )
      }
    }

    await this.notifyProjectCreated(
      projectId,
      nic,
      String(details.ownerNameAsPerDeed ?? ''),
      String(details.bankEmail ?? '').trim(),
    )

    const coordinatorId = (body.coordinatorId ?? '').trim()
    if (coordinatorId) {
      await this.notifications.create(
        coordinatorId,
        `Project ${projectId} created for ${String(details.ownerNameAsPerDeed ?? 'the applicant')} (NIC ${nic}).`,
      )
    }

    return projectId
  }

  private async notifyProjectCreated(projectId: string, nic: string, ownerName: string, bankEmail: string) {
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
      await this.mail.sendProjectCreated(applicantEmail, { projectId, nic, ownerName, audience: 'applicant' })
    }
    await this.notifications.create(
      nic,
      `Your land valuation project ${projectId} has been created and is now being processed.`,
    )

    if (bankEmail) {
      await this.mail.sendProjectCreated(bankEmail, { projectId, nic, ownerName, audience: 'bank' })
      const bankUserId = await this.notifications.resolveBankUserId(bankEmail)
      if (bankUserId) {
        await this.notifications.create(
          bankUserId,
          `A new valuation project (${projectId}) has been created for the application you referred (NIC ${nic}).`,
        )
      }
    }
  }

  async details(projectId: string) {
    const p = (projectId ?? '').trim()
    const pr = await this.db.query(`SELECT applicant_nic, status, details, created_at FROM projects WHERE project_id = $1`, [p])
    const row = pr.rows[0]
    if (!row) return null
    const files = await this.db.query(
      `SELECT DISTINCT ON (file_type) file_type, file_name FROM project_files
        WHERE project_id = $1
          AND (object_key <> '' OR file_data IS NOT NULL OR file_path <> '')
        ORDER BY file_type, id DESC`,
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

  async fileAttachment(projectId: string, fileType: string) {
    const r = await this.db.query(
      `SELECT file_name, mime, object_key FROM project_files
        WHERE project_id = $1 AND file_type = $2 ORDER BY id DESC LIMIT 1`,
      [(projectId ?? '').trim(), (fileType ?? '').trim()],
    )
    const p = r.rows[0]
    if (!p?.object_key) return null
    const objectData = await this.storage.read(p.object_key as string)
    return {
      fileName: p.file_name as string,
      mime: (p.mime as string) || 'application/octet-stream',
      data: objectData,
    }
  }
}
