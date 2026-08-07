import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export type StoredUpload = { objectKey: string; databaseFallback: null }

// The original files live in one private Supabase Storage bucket. PostgreSQL
// stores only the returned object key and ordinary metadata.
@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name)
  private readonly bucket: string
  private readonly client: SupabaseClient | null

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
      this.logger.error('Supabase Storage is not configured. File uploads and downloads are disabled.')
    }
  }

  isConfigured() { return !!this.client }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Supabase Storage is not configured. Set SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_STORAGE_BUCKET.',
      )
    }
    return this.client
  }

  async store(file: Express.Multer.File, area: string): Promise<StoredUpload> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
    const objectKey = `${area}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`
    const { error } = await this.requireClient().storage.from(this.bucket).upload(objectKey, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw new ServiceUnavailableException(`File upload failed: ${error.message}`)
    return { objectKey, databaseFallback: null }
  }

  async read(objectKey?: string | null): Promise<Buffer | null> {
    if (!objectKey) return null
    const { data, error } = await this.requireClient().storage.from(this.bucket).download(objectKey)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  }
}
