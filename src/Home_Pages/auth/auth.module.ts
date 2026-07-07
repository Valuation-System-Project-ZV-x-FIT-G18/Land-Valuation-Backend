import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { UsersService } from './users.service'

@Module({
  controllers: [AuthController],
  providers: [AuthService, UsersService],
})
export class AuthModule {}
