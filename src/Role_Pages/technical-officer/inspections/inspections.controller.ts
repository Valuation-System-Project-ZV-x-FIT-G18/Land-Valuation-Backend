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
import { memoryStorage } from 'multer'
import { InspectionsService } from './inspections.service'
import { SaveInspectionDto } from './dto/save-inspection.dto'

@Controller('technical-officer/inspections')
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  // POST /api/technical-officer/inspections/ocr — upload handwritten form, returns OCR fields.
  @Post('ocr')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async ocr(@Body('projectId') projectId: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) return { fields: {}, rawText: '', ocrError: 'No file uploaded.' }
    return this.inspections.ocr(projectId ?? '', file)
  }

  // GET /api/technical-officer/inspections?projectId=...
  @Get()
  async get(@Query('projectId') projectId: string) {
    return { data: await this.inspections.get(projectId ?? '') }
  }

  // POST /api/technical-officer/inspections
  @Post()
  async save(@Body() dto: SaveInspectionDto) {
    return this.inspections.save(dto.projectId, dto.toId, dto.data)
  }
}
