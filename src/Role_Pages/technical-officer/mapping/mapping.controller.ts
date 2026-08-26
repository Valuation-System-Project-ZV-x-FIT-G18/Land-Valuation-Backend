//02
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { MappingService } from './mapping.service'
import { SaveMappingDto } from './dto/mapping.dto'
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'
import { TechnicalOfficerProjectAccessService } from '../shared/technical-officer-project-access.service'

@Controller('technical-officer/mapping')
export class MappingController {
  constructor(private readonly mapping: MappingService, private readonly access: TechnicalOfficerProjectAccessService) {}

  @Get('location')
  async location(@Query('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(projectId ?? '', user)
    const res = await this.mapping.location(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  @Post()
  async save(@Body() dto: SaveMappingDto, @CurrentUser() user: AuthUser) {
    await this.access.assertAssigned(dto.projectId, user)
    return this.mapping.save(
      dto.projectId, dto.lat, dto.lng,
      dto.accessDescription, dto.localityDescription,
      dto.accessSources ?? [], dto.localitySources ?? [],
    )
  }
}
