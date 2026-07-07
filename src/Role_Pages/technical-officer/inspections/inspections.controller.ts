import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { InspectionsService } from './inspections.service'

const uploadDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

@Controller('technical-officer/inspections')
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  // POST /api/technical-officer/inspections/ocr — upload the handwritten form,
  // returns OCR-extracted draft fields (does NOT save).
  @Post('ocr')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async ocr(@UploadedFile() file?: Express.Multer.File) {
    if (!file) return { fields: {}, rawText: '', ocrError: 'No file uploaded.' }
    return this.inspections.ocr(file.filename, file.originalname)
  }

  // GET /api/technical-officer/inspections?projectId=... — existing draft/data.
  @Get()
  async get(@Query('projectId') projectId: string) {
    return { data: await this.inspections.get(projectId ?? '') }
  }

  // POST /api/technical-officer/inspections — save the edited inspection.
  @Post()
  async save(
    @Body() body: { projectId: string; toId: string; data: Record<string, string> },
  ) {
    return this.inspections.save(body.projectId, body.toId, body.data)
  }
}
