import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import type { Response } from 'express'
import { ProjectDetailsService } from './project-details.service'
import { CreateProjectDetailsDto, UpdateProjectDetailsDto } from './dto/project-details.dto'

@Controller('applicant/project-details')
export class ProjectDetailsController {
  constructor(private readonly projectDetails: ProjectDetailsService) {}

  // GET /api/applicant/project-details?nic=... — all of this applicant's
  // drafts (used by their own Fill Form list and the coordinator's picker).
  @Get()
  async list(@Query('nic') nic: string) {
    return { drafts: await this.projectDetails.list(nic ?? '') }
  }

  // GET /api/applicant/project-details/file?draftId=&docType=
  @Get('file')
  async file(
    @Query('draftId') draftId: string,
    @Query('docType') docType: string,
    @Res() res: Response,
  ) {
    const f = await this.projectDetails.attachment(Number(draftId), docType ?? '')
    if (!f) { res.status(404).json({ error: 'File not found.' }); return }
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`)
    if (!f.data) { res.status(404).json({ error: 'Object not found in Supabase Storage.' }); return }
    res.setHeader('Content-Type', f.mime || 'application/octet-stream'); res.send(f.data)
  }

  // POST /api/applicant/project-details — save a new draft.
  @Post()
  async create(@Body() dto: CreateProjectDetailsDto) {
    return this.projectDetails.create(dto.nic, dto.label ?? '', dto.data)
  }

  // POST /api/applicant/project-details/:id/file — attach/replace one
  // document on a draft ({ nic, docType } + file).
  @Post(':id/file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @Param('id') id: string,
    @Body() body: { nic?: string; docType?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.projectDetails.saveFile(Number(id), body.nic ?? '', body.docType ?? '', file)
  }

  // PUT /api/applicant/project-details/:id — update one of the applicant's own drafts.
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDetailsDto) {
    return this.projectDetails.update(Number(id), dto.nic, dto.label ?? '', dto.data)
  }

  // DELETE /api/applicant/project-details/:id?nic=...
  @Delete(':id')
  async remove(@Param('id') id: string, @Query('nic') nic: string) {
    return this.projectDetails.remove(Number(id), nic ?? '')
  }

  // POST /api/applicant/project-details/:id/use — the coordinator calls this
  // once a project has actually been created from the draft, so it isn't
  // silently reused for a later, unrelated project.
  @Post(':id/use')
  async markUsed(@Param('id') id: string) {
    return this.projectDetails.markUsed(Number(id))
  }
}
