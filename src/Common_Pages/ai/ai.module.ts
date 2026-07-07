import { Global, Module } from '@nestjs/common'
import { AiService } from './ai.service'

// Global so any feature can inject AiService.
@Global()
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
