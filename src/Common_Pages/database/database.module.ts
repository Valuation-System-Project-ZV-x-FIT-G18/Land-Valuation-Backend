import { Global, Module } from '@nestjs/common'
import { DatabaseService } from './database.service'

// @Global means any module can use DatabaseService without importing this.
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
