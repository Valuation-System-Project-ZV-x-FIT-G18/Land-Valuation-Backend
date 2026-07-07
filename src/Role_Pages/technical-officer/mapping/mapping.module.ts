import { Module } from '@nestjs/common'
import { MappingController } from './mapping.controller'
import { MappingService } from './mapping.service'

// DatabaseService and AiService are provided globally.
@Module({
  controllers: [MappingController],
  providers: [MappingService],
})
export class MappingModule {}
