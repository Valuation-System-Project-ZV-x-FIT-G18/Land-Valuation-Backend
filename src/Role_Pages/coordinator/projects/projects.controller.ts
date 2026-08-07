import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import type { Response } from 'express'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { join } from 'path'
import { existsSync } from 'fs'
import { ProjectsService } from './projects.service'
import { CreateProjectDto } from './dto/create-project.dto'

const uploadDir = join(process.cwd(), 'uploads')

function sendFileResponse(
  res: Response,
  file: { fileName: string; filePath?: string; mime?: string; data?: Buffer | null },
) {
  if (file.data) {
    res.setHeader('Content-Type', file.mime || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
    res.send(file.data)
    return
  }
  if (file.filePath) {
    const path = join(uploadDir, file.filePath)
    if (!existsSync(path)) {
      res.status(410).json({
        error: 'This legacy file is no longer present on the server. Please upload it again.',
      })
      return
    }
    res.sendFile(path)
    return
  }
  res.status(404).json({ error: 'File not found.' })
}

const fileFields = [
  { name: 'surveyPlan', maxCount: 1 },
  { name: 'titleDeed', maxCount: 1 },
  { name: 'taxCertificate', maxCount: 1 },
  { name: 'streetLineCert', maxCount: 1 },
  { name: 'planApprovalLetter', maxCount: 1 },
  { name: 'udaApproval', maxCount: 1 },
  { name: 'coc', maxCount: 1 },
  { name: 'bankRequestLetter', maxCount: 1 },
  { name: 'previousValuation', maxCount: 1 },
]

@Controller('coordinator/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('lookup')
  async lookup(@Query('q') q: string) {
    const project = await this.projects.findByNicOrId(q ?? '')
    return { found: !!project, project: project ?? undefined }
  }

  @Get('status')
  async status(@Query('q') q: string) {
    const projects = await this.projects.listStatus(q ?? '')
    return { projects }
  }

  @Get('details')
  async details(@Query('projectId') projectId: string) {
    const res = await this.projects.details(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  @Get('file')
  async file(
    @Query('projectId') projectId: string,
    @Query('type') type: string,
    @Res() res: Response,
  ) {
    const f = await this.projects.fileAttachment(projectId ?? '', type ?? '')
    if (!f) {
      res.status(404).json({ error: 'File not found.' })
      return
    }
    sendFileResponse(res, f)
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(fileFields, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async create(
    @Body() dto: CreateProjectDto,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
  ) {
    const projectId = await this.projects.create(dto, files ?? {})
    return { ok: true, projectId }
  }
}
