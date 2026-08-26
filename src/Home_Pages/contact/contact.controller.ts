import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ContactService } from './contact.service'
import { CreateContactDto } from './dto/create-contact.dto'
import { Public } from '../auth/decorators/public.decorator'

// Handles HTTP requests for contact messages (the "controller" layer).
// Route: POST /api/contact
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Public()
  async create(@Body() dto: CreateContactDto) {
    await this.contactService.create(dto)
    return { ok: true }
  }

  // GET /api/contact — list all messages (coordinator's "Contact Messages" page).
  @Get()
  async list() {
    return { messages: await this.contactService.list() }
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    return { ok: true, message: await this.contactService.updateStatus(Number(id), body.status ?? '') }
  }
}
