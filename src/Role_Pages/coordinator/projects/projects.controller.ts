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
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { ProjectsService } from './projects.service'

// Where uploaded files are stored on disk.
const uploadDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

// Section 13 document uploads the form sends.
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
  // Used by New Valuation to confirm a project exists for the applicant.
  @Get('lookup')
  async lookup(@Query('q') q: string) {
    const project = await this.projects.findByNicOrId(q ?? '')
    return { found: !!project, project: project ?? undefined }
  }

  // GET /api/coordinator/projects/status?q=<nic or project id>
  // Powers the Project Status page (empty q -> all recent projects).
  @Get('status')
  async status(@Query('q') q: string) {
    const projects = await this.projects.listStatus(q ?? '')
    return { projects }
  }

  // GET /api/coordinator/projects/details?projectId=... — all stored details + documents.
  @Get('details')
  async details(@Query('projectId') projectId: string) {
    const res = await this.projects.details(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  // GET /api/coordinator/projects/file?projectId=&type=surveyPlan — view an
  // uploaded project document (survey plan, title deed, etc.).
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
    res.sendFile(join(uploadDir, f.filePath))
  }

  // POST /api/coordinator/projects  (multipart/form-data)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(fileFields, {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) =>
          cb(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`,
          ),
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
    }),
  )
  async create(
    @Body() body: Record<string, string>,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
  ) {
    const projectId = await this.projects.create(body, files ?? {})
    return { ok: true, projectId }
  }
}
