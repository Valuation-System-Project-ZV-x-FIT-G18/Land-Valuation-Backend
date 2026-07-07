import { Body, Controller, Get, Post } from '@nestjs/common'
import { ContactService } from './contact.service'
import { CreateContactDto } from './dto/create-contact.dto'

// Handles HTTP requests for contact messages (the "controller" layer).
// Route: POST /api/contact
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  async create(@Body() dto: CreateContactDto) {
    await this.contactService.create(dto)
    return { ok: true }
  }

  // GET /api/contact — list all messages (coordinator's "Contact Messages" page).
  @Get()
  async list() {
    return { messages: await this.contactService.list() }
  }
}
