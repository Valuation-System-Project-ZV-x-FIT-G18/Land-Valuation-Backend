import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { MappingService } from './mapping.service'

// Technical Officer — "GPS & Map Integration": choose the property location on a
// map, view satellite/map imagery, and generate an AI access-route description.
@Controller('technical-officer/mapping')
export class MappingController {
  constructor(private readonly mapping: MappingService) {}

  @Get('location')
  async location(@Query('projectId') projectId: string) {
    const res = await this.mapping.location(projectId ?? '')
    return res ?? { error: 'Project not found.' }
  }

  @Post('access')
  async access(@Body() body: { projectId: string; lat: number; lng: number }) {
    return this.mapping.generateAccess(String(body.projectId ?? ''), Number(body.lat), Number(body.lng))
  }

  @Post('locality')
  async locality(@Body() body: { projectId: string; lat: number; lng: number }) {
    return this.mapping.generateLocality(String(body.projectId ?? ''), Number(body.lat), Number(body.lng))
  }

  @Get()
  async get(@Query('projectId') projectId: string) {
    return { data: await this.mapping.get(projectId ?? '') }
  }

  @Post()
  async save(
    @Body()
    body: {
      projectId: string
      lat: number
      lng: number
      accessDescription: string
      localityDescription: string
      accessSources?: string[]
      localitySources?: string[]
    },
  ) {
    return this.mapping.save(
      String(body.projectId ?? ''),
      Number(body.lat),
      Number(body.lng),
      body.accessDescription ?? '',
      body.localityDescription ?? '',
      body.accessSources ?? [],
      body.localitySources ?? [],
    )
  }
}
