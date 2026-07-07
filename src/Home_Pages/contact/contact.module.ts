import { Module } from '@nestjs/common'
import { ContactController } from './contact.controller'
import { ContactService } from './contact.service'

// Groups the contact controller + service together (the "module" layer).
@Module({
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
