//03
import { Module } from '@nestjs/common'
import { MappingController } from './mapping.controller'
import { MappingService } from './mapping.service'

// DatabaseService is provided globally.
@Module({
  controllers: [MappingController],
  providers: [MappingService],
})
export class MappingModule {}
