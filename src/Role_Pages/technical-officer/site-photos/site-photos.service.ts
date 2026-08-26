import { ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { AiService } from '../../../Common_Pages/ai/ai.service'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

// Site photographs a technical officer uploads per project. One row per
// (project, photo type); re-uploading replaces the previous photo. For the main
// photo categories, a very short AI caption is generated from the image.
@Injectable()
export class SitePhotosService {
  private readonly logger = new Logger(SitePhotosService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly storage: ObjectStorageService,
  ) {}

  async assertReadable(projectId: string, user: AuthUser) {
    if (['Admin', 'Coordinator', 'Manager L1', 'Manager L2', 'Manager L3'].includes(user.role)) return
    if (user.role !== 'Technical Officer') throw new ForbiddenException('You cannot access these project photographs.')
    const result = await this.db.query(
      `SELECT 1 FROM valuations WHERE project_id = $1 AND technical_officer_id = $2 LIMIT 1`,
      [(projectId ?? '').trim(), user.userId],
    )
    if (!result.rowCount) throw new ForbiddenException('This project is not assigned to you.')
  }

  async assertEditable(projectId: string, user: AuthUser) {
    if (user.role !== 'Technical Officer') throw new ForbiddenException('Only a technical officer can upload site photographs.')
    return this.assertReadable(projectId, user)
  }



  async list(projectId: string) {
    const r = await this.db.query(
      `SELECT photo_type, file_name, description, created_at
         FROM site_photos WHERE project_id = $1`,
      [(projectId ?? '').trim()],
    )
    return r.rows.map((p) => ({
      photoType: p.photo_type as string,
      fileName: p.file_name as string,
      description: (p.description as string) ?? '',
      createdAt: p.created_at as string,
    }))
  }

  async upload(
    projectId: string,
    toId: string,
    photoType: string,
    file?: Express.Multer.File,
    describe = false,
    photoLabel = '',
  ) {
    const p = (projectId ?? '').trim()
    const t = (photoType ?? '').trim()
    if (!p || !t || !file) return { ok: false, error: 'Missing details or file.' }

    // Caption the image (only for the main categories, never "additional").
    const description = describe ? await this.caption(file.buffer, file.mimetype, photoLabel || t) : ''
    const stored = await this.storage.store(file, `site-photos/${p}/${t}`)

    await this.db.query(
      `INSERT INTO site_photos (project_id, to_id, photo_type, file_name, file_path, description, file_mime, file_data, object_key)
       VALUES ($1, $2, $3, $4, '', $5, $6, $7, $8)
       ON CONFLICT (project_id, photo_type)
       DO UPDATE SET to_id = EXCLUDED.to_id, file_name = EXCLUDED.file_name,
                     file_path = '', description = EXCLUDED.description, file_mime = EXCLUDED.file_mime,
                     file_data = EXCLUDED.file_data, object_key = EXCLUDED.object_key,
                     created_at = now()`,
      [p, (toId ?? '').trim(), t, file.originalname, description, file.mimetype, stored.databaseFallback, stored.objectKey],
    )
    return { ok: true, description }
  }

  // One very short AI caption of the uploaded photograph.
  private async caption(buf: Buffer, mime: string, label: string): Promise<string> {
    if (!this.ai.isEnabled()) return ''
    try {
      const image = { mediaType: mime || 'image/jpeg', base64: buf.toString('base64') }
      const prompt =
        `This is a land-valuation site photograph labelled "${label}". ` +
        `In ONE short sentence (max 14 words), describe what it shows. Output only the sentence.`
      const text = (await this.ai.generate(prompt, [image])).trim()
      return text.slice(0, 200)
    } catch (err) {
      this.logger.error(`Photo caption failed: ${(err as Error).message}`)
      return ''
    }
  }

  async attachment(projectId: string, photoType: string) {
    const r = await this.db.query(
      `SELECT file_name, file_mime, file_data, object_key FROM site_photos
        WHERE project_id = $1 AND photo_type = $2`,
      [(projectId ?? '').trim(), (photoType ?? '').trim()],
    )
    const p = r.rows[0]
    if (!p) return null
    const objectData = p.object_key ? await this.storage.read(p.object_key as string) : null
    const databaseFallback = Buffer.isBuffer(p.file_data) ? p.file_data : null
    return {
      fileName: p.file_name as string,
      mime: (p.file_mime as string) || 'image/jpeg',
      data: objectData ?? databaseFallback,
    }
  }
}
