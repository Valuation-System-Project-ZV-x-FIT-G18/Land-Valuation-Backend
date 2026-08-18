//02
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { MappingService } from './mapping.service'
import { SaveMappingDto } from './dto/mapping.dto'

@Controller('technical-officer/mapping')
export class MappingController {
  constructor(private readonly mapping: MappingService) {}

  @Get('location')
  async location(@Query('projectId') projectId: string) {
    const res = await this.mapping.location(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  @Post()
  async save(@Body() dto: SaveMappingDto) {
    return this.mapping.save(
      dto.projectId, dto.lat, dto.lng,
      dto.accessDescription, dto.localityDescription,
      dto.accessSources ?? [], dto.localitySources ?? [],
    )
  }
}
