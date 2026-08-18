import { Injectable, Logger } from '@nestjs/common'

// Wraps Google Gemini's free API for content generation. If GEMINI_API_KEY is
// not set, isEnabled() is false and callers fall back to templates.
// Get a free key (no card) at https://aistudio.google.com/apikey
type Img = { mediaType: string; base64: string }

// Free-tier daily request quotas are PER MODEL and small (~20/day each). We use
// gemini-2.5-flash here; if its daily quota is exhausted, switch to another model
// (e.g. gemini-2.5-flash-lite / gemini-2.0-flash) or enable billing for real use.
const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  isEnabled(): boolean {
    return !!process.env.GEMINI_API_KEY
  }

  // Generate text from a prompt, optionally with images (for vision/analysis).
  // useSearch: enable Google Search grounding so the model actually researches
  // the live web (used for finding real comparable land listings).
  async generate(prompt: string, images: Img[] = [], useSearch = false): Promise<string> {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('AI is not configured (GEMINI_API_KEY missing).')

    // Build the parts array: the images first, then the text prompt.
    const parts: Record<string, unknown>[] = images.map((img) => ({
      inline_data: { mime_type: img.mediaType, data: img.base64 },
    }))
    parts.push({ text: prompt })

    const body = JSON.stringify({
      contents: [{ parts }],
      // Web-search grounding lets the model look across the whole internet.
      ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: {
        maxOutputTokens: 4096,
        // 2.5 models "think" by default, which eats the output budget and can
        // truncate JSON. thinkingBudget 0 disables it for direct, complete replies.
        // (Grounded search needs thinking, so only disable it when not searching.)
        ...(useSearch ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
      },
    })

    // Retry transient overload/rate errors (503/429) a couple of times.
    let lastStatus = 0
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), useSearch ? 40_000 : 12_000)
      let res: Response
      try {
        res = await fetch(`${ENDPOINT}?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        })
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Gemini API timed out after ${useSearch ? 40 : 12} seconds`)
        }
        throw error
      } finally {
        clearTimeout(timeout)
      }
      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[]
        }
        const textParts = data.candidates?.[0]?.content?.parts ?? []
        return textParts.map((p) => p.text ?? '').join('').trim()
      }
      lastStatus = res.status
      const detail = await res.text().catch(() => '')
      this.logger.error(`Gemini API error ${res.status}: ${detail.slice(0, 200)}`)
      if (res.status !== 503 && res.status !== 429) break
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
    }
    throw new Error(`Gemini API returned ${lastStatus}`)
  }
}
