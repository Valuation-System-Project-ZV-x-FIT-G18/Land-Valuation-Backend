import { Module } from '@nestjs/common'
import { NearbyController } from './nearby.controller'
import { NearbyService } from './nearby.service'

// AiService is provided globally (AiModule); DatabaseService is global too.
@Module({
  controllers: [NearbyController],
  providers: [NearbyService],
})
export class NearbyModule {}
