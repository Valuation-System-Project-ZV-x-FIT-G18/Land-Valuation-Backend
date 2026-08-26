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
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

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
  async ocr(@Body('projectId') projectId: string, @CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    await this.inspections.assertAssigned(projectId ?? '', user)
    if (!file) return { fields: {}, rawText: '', ocrError: 'No file uploaded.' }
    return this.inspections.ocr(projectId ?? '', file)
  }

  // GET /api/technical-officer/inspections?projectId=...
  @Get()
  async get(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.inspections.assertAssigned(projectId ?? '', user)
    return { data: await this.inspections.get(projectId ?? '') }
  }

  // POST /api/technical-officer/inspections
  @Post()
  async save(@Body() dto: SaveInspectionDto, @CurrentUser() user: AuthUser) {
    await this.inspections.assertAssigned(dto.projectId, user)
    return this.inspections.save(dto.projectId, user.userId, dto.data)
  }
}
