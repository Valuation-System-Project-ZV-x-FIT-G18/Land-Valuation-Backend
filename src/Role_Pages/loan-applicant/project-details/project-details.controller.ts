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

<<<<<<< HEAD
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
      res.status(410).json({ error: 'This legacy document is missing. Please upload it again.' })
      return
    }
    res.download(path, file.fileName)
    return
  }
  res.status(404).json({ error: 'File not found.' })
}

=======
>>>>>>> b75f317 (Describe your changes)
@Controller('applicant/project-details')
export class ProjectDetailsController {
  constructor(private readonly projectDetails: ProjectDetailsService) {}

  @Get()
  async list(@Query('nic') nic: string) {
    return { drafts: await this.projectDetails.list(nic ?? '') }
  }

  @Get('file')
  async file(
    @Query('draftId') draftId: string,
    @Query('docType') docType: string,
    @Res() res: Response,
  ) {
    const f = await this.projectDetails.attachment(Number(draftId), docType ?? '')
<<<<<<< HEAD
    if (!f) {
      res.status(404).json({ error: 'File not found.' })
      return
    }
    sendFileResponse(res, f)
=======
    if (!f) { res.status(404).json({ error: 'File not found.' }); return }
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`)
    if (!f.data) { res.status(404).json({ error: 'Object not found in Supabase Storage.' }); return }
    res.setHeader('Content-Type', f.mime || 'application/octet-stream'); res.send(f.data)
>>>>>>> b75f317 (Describe your changes)
  }

  @Post()
  async create(@Body() dto: CreateProjectDetailsDto) {
    return this.projectDetails.create(dto.nic, dto.label ?? '', dto.data)
  }

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

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDetailsDto) {
    return this.projectDetails.update(Number(id), dto.nic, dto.label ?? '', dto.data)
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Query('nic') nic: string) {
    return this.projectDetails.remove(Number(id), nic ?? '')
  }

  @Post(':id/use')
  async markUsed(@Param('id') id: string) {
    return this.projectDetails.markUsed(Number(id))
  }
}
