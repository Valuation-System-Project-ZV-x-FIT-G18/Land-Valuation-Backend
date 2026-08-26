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
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

@Controller('applicant/project-details')
export class ProjectDetailsController {
  constructor(private readonly projectDetails: ProjectDetailsService) {}

  // GET /api/applicant/project-details?nic=... — all of this applicant's
  // drafts (used by their own Fill Form list and the coordinator's picker).
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return { drafts: await this.projectDetails.list(user.userId) }
  }

  // GET /api/applicant/project-details/file?draftId=&docType=
  @Get('file')
  async file(
    @Query('draftId') draftId: string,
    @Query('docType') docType: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const f = await this.projectDetails.attachment(Number(draftId), docType ?? '', user.userId)
    if (!f) { res.status(404).json({ error: 'File not found.' }); return }
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`)
    if (!f.data) { res.status(404).json({ error: 'Object not found in Supabase Storage.' }); return }
    res.setHeader('Content-Type', f.mime || 'application/octet-stream'); res.send(f.data)
  }

  // POST /api/applicant/project-details — save a new draft.
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDetailsDto) {
    return this.projectDetails.create(user.userId, dto.label ?? '', dto.data)
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
    @CurrentUser() user?: AuthUser,
  ) {
    return this.projectDetails.saveFile(Number(id), user?.userId ?? '', body.docType ?? '', file)
  }

  // PUT /api/applicant/project-details/:id — update one of the applicant's own drafts.
  @Put(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProjectDetailsDto) {
    return this.projectDetails.update(Number(id), user.userId, dto.label ?? '', dto.data)
  }

  // DELETE /api/applicant/project-details/:id?nic=...
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projectDetails.remove(Number(id), user.userId)
  }

  // POST /api/applicant/project-details/:id/use — the coordinator calls this
  // once a project has actually been created from the draft, so it isn't
  // silently reused for a later, unrelated project.
  @Post(':id/use')
  async markUsed(@Param('id') id: string) {
    return this.projectDetails.markUsed(Number(id))
  }
}
