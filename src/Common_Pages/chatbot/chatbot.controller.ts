import { Body, Controller, Post } from '@nestjs/common'
import { ChatbotService } from './chatbot.service'
import { ChatDto } from './dto/chat.dto'

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService) {}

  @Post('message')
  chat(@Body() dto: ChatDto) {
    return this.chatbot.chat(dto)
  }
}
