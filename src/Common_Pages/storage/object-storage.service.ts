import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

export type StoredUpload = { objectKey: string; databaseFallback: Buffer | null }

// The original files live in private object storage. PostgreSQL also receives
// a byte fallback so future downloads can survive remote storage issues.
@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name)
  private readonly bucket: string
  private readonly client: SupabaseClient | null
  private readonly localRoot = join(process.cwd(), 'uploads', 'objects')

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL')?.trim()
    const secretKey = config.get<string>('SUPABASE_SECRET_KEY')?.trim()
    this.bucket = config.get<string>('SUPABASE_STORAGE_BUCKET')?.trim() ?? ''
    this.client = url && secretKey && this.bucket
      ? createClient(url, secretKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null
    if (!this.client) {
      this.logger.warn('Supabase Storage is not configured; uploads will use local object storage.')
    }
  }

  isConfigured() { return !!this.client }

  private async storeLocal(file: Express.Multer.File, objectKey: string): Promise<StoredUpload> {
    const localKey = `local/${objectKey}`
    const target = join(this.localRoot, ...objectKey.split('/'))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, file.buffer)
    return { objectKey: localKey, databaseFallback: file.buffer }
  }

  async store(file: Express.Multer.File, area: string): Promise<StoredUpload> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
    const objectKey = `${area}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`
    if (!this.client) return this.storeLocal(file, objectKey)

    const { error } = await this.client.storage.from(this.bucket).upload(objectKey, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false,
    })
    if (error) {
      this.logger.warn(`Supabase upload failed; using local fallback: ${error.message}`)
      return this.storeLocal(file, objectKey)
    }
    return { objectKey, databaseFallback: file.buffer }
  }

  // Store a server-generated artifact (for example, a finalized PDF) using
  // the same private bucket/local fallback policy as uploaded files.
  async storeBuffer(buffer: Buffer, fileName: string, mimeType: string, area: string): Promise<StoredUpload> {
    return this.store({
      buffer,
      originalname: fileName,
      mimetype: mimeType,
    } as Express.Multer.File, area)
  }

  async read(objectKey?: string | null): Promise<Buffer | null> {
    if (!objectKey) return null
    if (objectKey.startsWith('local/')) {
      const relative = objectKey.slice('local/'.length)
      if (!relative || relative.includes('..')) return null
      try { return await readFile(join(this.localRoot, ...relative.split('/'))) } catch { return null }
    }
    if (this.client) {
      try {
        const { data, error } = await this.client.storage.from(this.bucket).download(objectKey)
        if (!error && data) return Buffer.from(await data.arrayBuffer())
        if (error) this.logger.warn(`Supabase read failed for ${objectKey}: ${error.message}`)
      } catch (err) {
        this.logger.warn(`Supabase read failed for ${objectKey}: ${(err as Error).message}`)
      }
    }
    try { return await readFile(join(this.localRoot, ...objectKey.split('/'))) } catch { return null }
  }
}
