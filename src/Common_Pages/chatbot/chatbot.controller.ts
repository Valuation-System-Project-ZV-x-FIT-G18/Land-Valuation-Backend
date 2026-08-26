import { Body, Controller, Post } from '@nestjs/common'
import { ChatbotService } from './chatbot.service'
import { ChatDto } from './dto/chat.dto'
import { CurrentUser } from '../../Home_Pages/auth/decorators/current-user.decorator'
import type { AuthUser } from '../../Home_Pages/auth/types/auth-user'

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService) {}

  @Post('message')
  chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto) {
    return this.chatbot.chat(dto, user)
  }
}
