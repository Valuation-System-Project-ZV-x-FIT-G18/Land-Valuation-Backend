import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import { inspectionFields } from './inspection-fields'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'

// Site inspection reports. The technical officer uploads the handwritten form;
// we OCR it into a draft they can edit, then save the final data.
@Injectable()
export class InspectionsService implements OnModuleInit {
  private readonly logger = new Logger(InspectionsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly storage: ObjectStorageService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS inspections (
           id         SERIAL PRIMARY KEY,
           project_id VARCHAR(20) NOT NULL,
           to_id      VARCHAR(20) NOT NULL DEFAULT '',
           data       JSONB       NOT NULL DEFAULT '{}',
           status     VARCHAR(30) NOT NULL DEFAULT 'Completed',
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           UNIQUE (project_id)
         )`,
      )
      await this.db.query(`CREATE TABLE IF NOT EXISTS inspection_files (
        project_id VARCHAR(20) PRIMARY KEY REFERENCES projects(project_id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL, file_mime VARCHAR(100) NOT NULL DEFAULT '',
        file_data BYTEA, object_key VARCHAR(1024) NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
      await this.db.query(`ALTER TABLE inspection_files ALTER COLUMN file_data DROP NOT NULL`)
      await this.db.query(`ALTER TABLE inspection_files ADD COLUMN IF NOT EXISTS object_key VARCHAR(1024) NOT NULL DEFAULT ''`)
    } catch (err) {
      this.logger.error(`Inspections setup failed: ${(err as Error).message}`)
    }
  }

  // Run OCR on the uploaded file and parse it into draft fields.
  async ocr(projectId: string, file: Express.Multer.File) {
    let rawText = ''
    try {
      const p = (projectId ?? '').trim()
      if (p) {
        const stored = await this.storage.store(file, `inspection-forms/${p}`)
        await this.db.query(
          `INSERT INTO inspection_files (project_id, file_name, file_mime, file_data, object_key)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (project_id) DO UPDATE SET
           file_name=EXCLUDED.file_name,file_mime=EXCLUDED.file_mime,file_data=EXCLUDED.file_data,
           object_key=EXCLUDED.object_key,created_at=now()`,
          [p, file.originalname, file.mimetype, stored.databaseFallback, stored.objectKey],
        )
      }
      rawText = await this.runOcr(file.buffer, file.originalname)
    } catch (err) {
      this.logger.error(`OCR failed: ${(err as Error).message}`)
      return { fields: {}, rawText: '', ocrError: (err as Error).message }
    }
    return { fields: this.parse(rawText), rawText }
  }

  // Call the free OCR.space API (no native deps, accepts PDFs directly).
  private async runOcr(buffer: Buffer, filename: string): Promise<string> {
    const g = globalThis as unknown as {
      fetch: typeof fetch
      FormData: typeof FormData
      Blob: typeof Blob
      AbortController: typeof AbortController
    }
    const key = process.env.OCR_SPACE_API_KEY || 'helloworld'
    const form = new g.FormData()
    form.append('apikey', key)
    form.append('language', 'eng')
    form.append('OCREngine', '2') // engine 2 handles handwriting better
    form.append('scale', 'true')
    form.append('filetype', filename.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Auto')
    form.append('file', new g.Blob([new Uint8Array(buffer)]), filename)

    const ac = new g.AbortController()
    const timer = setTimeout(() => ac.abort(), 45000)
    try {
      const res = await g.fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: form,
        signal: ac.signal,
      })
      const data = (await res.json()) as {
        ParsedResults?: { ParsedText?: string }[]
        IsErroredOnProcessing?: boolean
        ErrorMessage?: string | string[]
      }
      if (data.IsErroredOnProcessing) {
        const m = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(' ') : data.ErrorMessage
        throw new Error(m || 'OCR service error.')
      }
      return (data.ParsedResults ?? []).map((r) => r.ParsedText ?? '').join('\n')
    } finally {
      clearTimeout(timer)
    }
  }

  // Section headings — used only as extra boundaries so a field value doesn't
  // run into the next section's title.
  private readonly sectionTitles = [
    'Access & Location',
    'Description of the Land',
    'Boundary Verification',
    'Locality Description',
    'Land Sale Evidence',
    'Valuation Figures',
    'Inspection Details',
  ]

  // Best-effort parse: locate each printed label in the OCR text, then take the
  // text between that label and the next label/section heading as its value.
  // This tolerates values that wrap onto the next line (common with OCR).
  private parse(text: string): Record<string, string> {
    const flat = text.replace(/\s+/g, ' ') // collapse newlines/spaces
    const flatLower = flat.toLowerCase()

    const anchors = [
      ...this.sectionTitles.map((t) => ({ key: '', label: t })),
      ...inspectionFields.map((f) => ({ key: f.key, label: f.label })),
    ]

    // Find where each label appears (flexible on punctuation/spacing). Section
    // headings also swallow their leading number (e.g. "6. Valuation Figures")
    // so it doesn't leak into the previous field's value.
    const found: { key: string; start: number; end: number }[] = []
    for (const a of anchors) {
      const core = a.label.toLowerCase().replace(/[^a-z0-9]+/g, '[^a-z0-9]+')
      const pattern = a.key === '' ? `\\d{0,2}[^a-z0-9]{0,4}${core}` : core
      const m = new RegExp(pattern, 'i').exec(flatLower)
      if (m) found.push({ key: a.key, start: m.index, end: m.index + m[0].length })
    }
    found.sort((x, y) => x.start - y.start)

    const out: Record<string, string> = {}
    for (let i = 0; i < found.length; i++) {
      const cur = found[i]
      if (!cur.key) continue // section heading, just a boundary
      const nextStart = found[i + 1]?.start ?? flat.length
      const value = flat
        .slice(cur.end, nextStart)
        .replace(/^[\s:._–-]+/, '') // leading colon / underscores / dashes
        .replace(/^\([^)]*\)\s*:?\s*/, '') // leftover label hint e.g. "(Land Only):"
        .replace(/_+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (value && !/^[_.\s:-]*$/.test(value)) out[cur.key] = value
    }
    return out
  }

  async get(projectId: string) {
    const r = await this.db.query(
      `SELECT data FROM inspections WHERE project_id = $1`,
      [(projectId ?? '').trim()],
    )
    return (r.rows[0]?.data as Record<string, string>) ?? null
  }

  async save(projectId: string, toId: string, data: Record<string, string>) {
    const p = (projectId ?? '').trim()
    if (!p) return { ok: false, error: 'Missing project.' }
    const existed = (await this.db.query(`SELECT 1 FROM inspections WHERE project_id = $1`, [p])).rowCount! > 0
    await this.db.query(
      `INSERT INTO inspections (project_id, to_id, data, status)
       VALUES ($1, $2, $3::jsonb, 'Completed')
       ON CONFLICT (project_id)
       DO UPDATE SET to_id = EXCLUDED.to_id, data = EXCLUDED.data,
                     status = 'Completed', created_at = now()`,
      [p, (toId ?? '').trim(), JSON.stringify(data ?? {})],
    )
    // Only notify the applicant + bank the FIRST time this inspection is
    // completed — later edits by the officer shouldn't re-notify.
    if (!existed) await this.notifyInspected(p)
    return { ok: true }
  }

  // Notify the loan applicant and the requesting bank that the site
  // inspection is complete. Never throws.
  private async notifyInspected(projectId: string) {
    try {
      const proj = (await this.db.query(`SELECT applicant_nic, bank_email FROM projects WHERE project_id = $1`, [projectId])).rows[0] as
        | { applicant_nic?: string; bank_email?: string }
        | undefined
      const nic = proj?.applicant_nic
      if (nic) {
        await this.notifications.create(
          nic,
          `The site inspection for your project ${projectId} has been completed. Your valuation report is now being prepared.`,
        )
      }
      const bankEmail = proj?.bank_email ?? ''
      if (bankEmail) {
        const bankUserId = await this.notifications.resolveBankUserId(bankEmail)
        if (bankUserId) {
          await this.notifications.create(
            bankUserId,
            `The site inspection for project ${projectId} has been completed. The valuation report is now being prepared.`,
          )
        }
      }
    } catch (err) {
      this.logger.error(`Inspection notification failed: ${(err as Error).message}`)
    }
  }
}
