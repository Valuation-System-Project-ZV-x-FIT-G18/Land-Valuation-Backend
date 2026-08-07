import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

export type StoredUpload = { objectKey: string; databaseFallback: Buffer | null }

@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name)
  private readonly bucket: string
  private readonly client: S3Client | null
  private readonly localRoot = join(process.cwd(), 'uploads', 'objects')

  constructor(config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID')?.trim()
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID')?.trim()
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY')?.trim()
    this.bucket = config.get<string>('R2_BUCKET_NAME')?.trim() ?? ''
    this.client = accountId && accessKeyId && secretAccessKey && this.bucket
      ? new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
        })
      : null
    if (!this.client) this.logger.warn('R2 is not configured; uploads will use local object storage.')
  }

  isConfigured() { return !!this.client }

  async store(file: Express.Multer.File, area: string): Promise<StoredUpload> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
    const objectKey = `${area}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`
    if (!this.client) {
      const localKey = `local/${objectKey}`
      const target = join(this.localRoot, ...objectKey.split('/'))
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, file.buffer)
      return { objectKey: localKey, databaseFallback: null }
    }
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: file.buffer,
      ContentType: file.mimetype || 'application/octet-stream',
      ContentDisposition: `inline; filename="${safeName.replace(/"/g, '')}"`,
      Metadata: { originalname: encodeURIComponent(file.originalname) },
    }))
    return { objectKey, databaseFallback: null }
  }

  async read(objectKey?: string | null): Promise<Buffer | null> {
    if (!objectKey) return null
    if (objectKey.startsWith('local/')) {
      const relative = objectKey.slice('local/'.length)
      if (!relative || relative.includes('..')) return null
      try { return await readFile(join(this.localRoot, ...relative.split('/'))) } catch { return null }
    }
    if (!this.client) return null
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }))
    if (!result.Body) return null
    return Buffer.from(await result.Body.transformToByteArray())
  }
}
