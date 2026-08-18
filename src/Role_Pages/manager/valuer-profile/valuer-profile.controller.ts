import { Body, Controller, Get, Put, Query } from '@nestjs/common'
import { SaveValuerProfileDto } from './dto/valuer-profile.dto'
import { ValuerProfileService } from './valuer-profile.service'

@Controller('manager/valuer-profile')
export class ValuerProfileController {
  constructor(private readonly profiles: ValuerProfileService) {}

  @Get()
  get(@Query('userId') userId: string) {
    return this.profiles.get(userId ?? '')
  }

  @Put()
  save(@Body() dto: SaveValuerProfileDto) {
    return this.profiles.save(dto)
  }
}
