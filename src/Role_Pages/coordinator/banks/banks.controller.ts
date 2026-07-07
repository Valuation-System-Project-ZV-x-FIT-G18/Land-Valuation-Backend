import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { BanksService } from './banks.service'
import { CreateBankDto } from './dto/create-bank.dto'

@Controller('coordinator/banks')
export class BanksController {
  constructor(private readonly banks: BanksService) {}

  // POST /api/coordinator/banks — register a bank branch/officer.
  @Post()
  async register(@Body() dto: CreateBankDto) {
    return this.banks.register(dto)
  }

  // GET /api/coordinator/banks/registered — all admin-registered banks (from users).
  @Get('registered')
  async registered() {
    return { banks: await this.banks.registeredBanks() }
  }

  // GET /api/coordinator/banks/search?ref=<nic or project id> — banks for a ref.
  @Get('search')
  async search(@Query('ref') ref: string) {
    return { banks: await this.banks.findByRef(ref ?? '') }
  }

  // GET /api/coordinator/banks — list registered banks.
  @Get()
  async list() {
    return { banks: await this.banks.list() }
  }
}
