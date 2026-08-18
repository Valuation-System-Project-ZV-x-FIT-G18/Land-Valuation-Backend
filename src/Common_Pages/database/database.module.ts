/*This module registers and exports `DatabaseService` for database access. The `@Global()` decorator makes the service available throughout the NestJS application without importing `DatabaseModule` into every feature module.*/
import { Global, Module } from '@nestjs/common'
import { DatabaseService } from './database.service'

// @Global means any module can use DatabaseService without importing this.
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
