import { Body, Controller, Get, Put } from '@nestjs/common'
import { SaveValuerProfileDto } from './dto/valuer-profile.dto'
import { ValuerProfileService } from './valuer-profile.service'
import { CurrentUser } from '../../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

@Controller('manager/valuer-profile')
export class ValuerProfileController {
  constructor(private readonly profiles: ValuerProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.profiles.get(user.userId)
  }

  @Put()
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveValuerProfileDto) {
    return this.profiles.save({ ...dto, userId: user.userId })
  }
}
