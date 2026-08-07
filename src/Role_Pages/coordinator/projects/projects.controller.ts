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
import { ProjectsService } from './projects.service'
import { CreateProjectDto } from './dto/create-project.dto'

const uploadDir = join(process.cwd(), 'uploads')

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

  // GET /api/coordinator/projects/lookup?q=<nic or project id>
  @Get('lookup')
  async lookup(@Query('q') q: string) {
    const project = await this.projects.findByNicOrId(q ?? '')
    return { found: !!project, project: project ?? undefined }
  }

  // GET /api/coordinator/projects/status?q=<nic or project id>
  @Get('status')
  async status(@Query('q') q: string) {
    const projects = await this.projects.listStatus(q ?? '')
    return { projects }
  }

  // GET /api/coordinator/projects/details?projectId=...
  @Get('details')
  async details(@Query('projectId') projectId: string) {
    const res = await this.projects.details(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  // GET /api/coordinator/projects/file?projectId=&type=surveyPlan
  @Get('file')
  async file(
    @Query('projectId') projectId: string,
    @Query('type') type: string,
    @Res() res: Response,
  ) {
    const f = await this.projects.fileAttachment(projectId ?? '', type ?? '')
    if (!f) { res.status(404).json({ error: 'File not found.' }); return }
    if (f.data) {
      res.setHeader('Content-Type', f.mime || 'application/octet-stream')
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`)
      res.send(f.data)
      return
    }
    // Backward compatibility for documents uploaded before database storage.
    res.sendFile(join(uploadDir, f.filePath))
  }

  // POST /api/coordinator/projects  (multipart/form-data)
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
