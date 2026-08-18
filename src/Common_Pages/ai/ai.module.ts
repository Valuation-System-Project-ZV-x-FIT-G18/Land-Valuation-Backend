//The main purpose of this file is to register `AiService` in the NestJS application and make it available for use anywhere in the project.

import { Global, Module } from '@nestjs/common'
import { AiService } from './ai.service'

// Global so any feature can inject AiService.
@Global()
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
