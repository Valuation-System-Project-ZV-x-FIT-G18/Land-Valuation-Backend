import { Body, Controller, Get, Post } from '@nestjs/common'
import { ValuationService } from './valuation.service'
import { CreateValuationDto } from './dto/create-valuation.dto'

// Route: POST /api/valuation
@Controller('valuation')
export class ValuationController {
  constructor(private readonly valuationService: ValuationService) {}

  @Post()
  async create(@Body() dto: CreateValuationDto) {
    await this.valuationService.create(dto)
    return { ok: true }
  }

  // GET /api/valuation — list all requests (coordinator's "New Requests" page).
  @Get()
  async list() {
    return { requests: await this.valuationService.list() }
  }
}
