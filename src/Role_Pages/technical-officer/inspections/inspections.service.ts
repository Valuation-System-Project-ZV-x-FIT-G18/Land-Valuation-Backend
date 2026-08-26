import { ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import { inspectionFields } from './inspection-fields'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

// Site inspection reports. The technical officer uploads the handwritten form;
// we OCR it into a draft they can edit, then save the final data.
@Injectable()
export class InspectionsService {
  private readonly logger = new Logger(InspectionsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly storage: ObjectStorageService,
  ) {}

  async assertAssigned(projectId: string, user: AuthUser) {
    if (user.role !== 'Technical Officer') throw new ForbiddenException('Only a technical officer can edit inspection data.')
    const result = await this.db.query(
      `SELECT 1 FROM valuations WHERE project_id = $1 AND technical_officer_id = $2 LIMIT 1`,
      [(projectId ?? '').trim(), user.userId],
    )
    if (!result.rowCount) throw new ForbiddenException('This project is not assigned to you.')
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

  // Indices of the longest strictly increasing subsequence of `orders`.
  //
  // `orders` is the printed position of each label, listed in the order the
  // labels were actually found in the OCR text. Anything outside the longest
  // increasing run is a label that matched in the wrong place. n is ~43, so the
  // straightforward quadratic version is both fast enough and easy to check.
  private longestOrderedRun(orders: number[]): Set<number> {
    if (orders.length === 0) return new Set()
    const length = orders.map(() => 1)
    const previous = orders.map(() => -1)
    let best = 0
    for (let i = 0; i < orders.length; i++) {
      for (let j = 0; j < i; j++) {
        if (orders[j] < orders[i] && length[j] + 1 > length[i]) {
          length[i] = length[j] + 1
          previous[i] = j
        }
      }
      if (length[i] > length[best]) best = i
    }
    const keep = new Set<number>()
    for (let i = best; i !== -1; i = previous[i]) keep.add(i)
    return keep
  }

  // Best-effort parse: locate each printed label in the OCR text, then take the
  // text between that label and the next label/section heading as its value.
  // This tolerates values that wrap onto the next line (common with OCR).
  private parse(text: string): Record<string, string> {
    const flat = text.replace(/\s+/g, ' ') // collapse newlines/spaces
    const flatLower = flat.toLowerCase()

    const anchors = [
      // order = position on the printed form. Section headings are only
      // boundaries, so they are exempt from the ordering check below.
      ...this.sectionTitles.map((t) => ({ key: '', label: t, order: -1 })),
      ...inspectionFields.map((f, index) => ({ key: f.key, label: f.label, order: index })),
    ]

    // Find where each label appears (flexible on punctuation/spacing). Section
    // headings also swallow their leading number (e.g. "6. Valuation Figures")
    // so it doesn't leak into the previous field's value.
    const found: { key: string; start: number; end: number; order: number }[] = []
    for (const a of anchors) {
      const core = a.label.toLowerCase().replace(/[^a-z0-9]+/g, '[^a-z0-9]+')
      const pattern = a.key === '' ? `\\d{0,2}[^a-z0-9]{0,4}${core}` : core
      const m = new RegExp(pattern, 'i').exec(flatLower)
      if (m) found.push({ key: a.key, start: m.index, end: m.index + m[0].length, order: a.order })
    }
    found.sort((x, y) => x.start - y.start)

    // Only the FIRST occurrence of each label is matched, so a label whose
    // words also appear earlier (in a heading, in the printed instructions, or
    // inside someone's handwriting) anchors in the wrong place. Because each
    // value is the text BETWEEN two anchors, one bad anchor corrupts its
    // neighbour's value too.
    //
    // The printed form has a fixed field order, so anchors must appear in that
    // order. Keep the largest run that does, and drop the rest: a field left
    // blank for the officer to type is far better than a confidently wrong one.
    const fieldAnchors = found.filter((f) => f.key)
    const keep = this.longestOrderedRun(fieldAnchors.map((f) => f.order))
    const dropped = fieldAnchors.filter((_, i) => !keep.has(i)).map((f) => f.key)
    if (dropped.length) {
      this.logger.warn(`OCR: ignored ${dropped.length} out-of-order label(s): ${dropped.join(', ')}`)
    }
    const kept = new Set(fieldAnchors.filter((_, i) => keep.has(i)))
    const ordered = found.filter((f) => !f.key || kept.has(f))

    const out: Record<string, string> = {}
    for (let i = 0; i < ordered.length; i++) {
      const cur = ordered[i]
      if (!cur.key) continue // section heading, just a boundary
      const nextStart = ordered[i + 1]?.start ?? flat.length
      let value = flat
        .slice(cur.end, nextStart)
        .replace(/^[\s:._–-]+/, '') // leading colon / underscores / dashes
        .replace(/^\([^)]*\)\s*:?\s*/, '') // leftover label hint e.g. "(Land Only):"
        .replace(/_+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      // Select fields are printed with an OCR-friendly reference such as
      // "Write one: Yes / Partially / No" followed by a ruled answer line.
      // Remove that printed reference, then convert handwriting case variants
      // (yes, YES) to the exact dropdown value (Yes).
      const definition = inspectionFields.find((field) => field.key === cur.key)
      if (definition?.options?.length) {
        const optionPattern = definition.options
          .map((option) => option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
          .join('\\s*[/|]\\s*')
        value = value.replace(new RegExp(`^write\\s+one\\s*:?\\s*${optionPattern}\\s*`, 'i'), '').trim()
        const normalized = definition.options.find((option) => option.toLowerCase() === value.toLowerCase())
        if (normalized) value = normalized
      }
      if (definition?.type === 'date') {
        // Officers use Sri Lankan day-first dates on paper. HTML date inputs
        // require ISO format, so 11/08/2026 (or 11-08-26) becomes 2026-08-11.
        const match = value.match(/\b(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2,4})\b/)
        if (match) {
          const day = Number(match[1])
          const month = Number(match[2])
          const year = Number(match[3]) + (match[3].length === 2 ? 2000 : 0)
          const date = new Date(Date.UTC(year, month - 1, day))
          if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
            value = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
          }
        }
      }
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
