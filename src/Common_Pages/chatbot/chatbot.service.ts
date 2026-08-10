import { Injectable, Logger } from '@nestjs/common'
import { AiService } from '../ai/ai.service'
import { DatabaseService } from '../database/database.service'
import { CHATBOT_KNOWLEDGE, KnowledgeSection } from './chatbot.knowledge'
import { ChatDto } from './dto/chat.dto'

const words = (value: string): string[] => Array.from(value.toLowerCase().match(/[a-z0-9\u0D80-\u0DFF]+/g) ?? [])

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name)

  constructor(private readonly db: DatabaseService, private readonly ai: AiService) {}

  private retrieve(question: string, role: string): KnowledgeSection[] {
    const query = new Set(words(question))
    return CHATBOT_KNOWLEDGE
      .filter((section) => section.roles.includes(role))
      .map((section) => {
        const searchable = words(`${section.title} ${section.content}`)
        let score = 0
        for (const token of searchable) if (query.has(token)) score += 1
        return { section, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ section }) => section)
  }

  async chat(dto: ChatDto) {
    // Prefer the database role. During a temporary DB outage, keep the help
    // assistant usable with the validated role from the logged-in UI session.
    let role = dto.role
    try {
      const result = await this.db.query('SELECT role FROM users WHERE user_id = $1 LIMIT 1', [dto.userId.trim()])
      if (result.rowCount) role = String(result.rows[0].role)
    } catch (error) {
      this.logger.warn(`Role lookup unavailable; using validated session role: ${(error as Error).message}`)
    }
    const sources = this.retrieve(dto.message, role)
    const context = sources.map((source, index) => `[${index + 1}] ${source.title}\n${source.content}`).join('\n\n')

    if (!this.ai.isEnabled()) {
      return {
        answer: `AI chat is not configured yet. Here is the most relevant guidance for your ${role} role:\n\n${sources.map((s) => s.content).join('\n\n')}`,
        sources: sources.map((s) => s.title), role, aiEnabled: false,
      }
    }

    const recent = (dto.history ?? []).slice(-6).map((item) => `${item.role}: ${item.content}`).join('\n')
    const prompt = `You are the role-aware support assistant for the CODEHUB Land Valuation System.
The verified user's role is: ${role}.
Answer only from the supplied knowledge context. Tailor steps and permissions to this role. Do not claim the user can access another role's tools. If the answer is not in the context, say you do not have enough system information and suggest contacting the Coordinator or Admin. Never invent project status, prices, legal advice, or personal data. Be concise and friendly. Reply in the same language as the user's latest question (Sinhala, English, or mixed).

KNOWLEDGE CONTEXT:
${context}

RECENT CONVERSATION:
${recent || '(none)'}

USER QUESTION:
${dto.message}`

    const answer = await this.ai.generate(prompt)
    return { answer, sources: sources.map((s) => s.title), role, aiEnabled: true }
  }
}
