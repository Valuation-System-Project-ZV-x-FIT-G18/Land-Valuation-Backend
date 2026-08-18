import { Controller, Get } from '@nestjs/common'
import { BanksService } from './banks.service'

@Controller('coordinator/banks')
export class BanksController {
  constructor(private readonly banks: BanksService) {}

  // GET /api/coordinator/banks/registered — all admin-registered banks (from users).
  @Get('registered')
  async registered() {
    return { banks: await this.banks.registeredBanks() }
  }
}
