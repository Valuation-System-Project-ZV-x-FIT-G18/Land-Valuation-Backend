// Pure helpers for the nearby-land valuation report: unit maths, currency,
// number-to-words, and safe JSON extraction from an AI response.

// Sri Lankan land units → perches. 1 acre = 160 perches, 1 rood = 40 perches,
// 1 hectare ≈ 395.369 perches. Perches are the base unit for pricing.
export function extentToPerches(d: Record<string, any>): number {
  const num = (k: string) => parseFloat(String(d[k] ?? '')) || 0
  const fromArP = num('extentAcres') * 160 + num('extentRoods') * 40 + num('extentPerches')
  if (fromArP > 0) return round2(fromArP)
  return round2(num('extentHectares') * 395.369)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// "Rs. 12,300,000" — Sri Lankan rupee, no decimals for large land values.
export function formatLKR(n: number): string {
  return 'Rs. ' + Math.round(n).toLocaleString('en-US')
}

// Pull the first JSON value (object or array) out of an AI reply that may be
// wrapped in ```json fences or surrounding prose.
export function parseJsonLoose(raw: string): any {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.search(/[[{]/)
    const end = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'))
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('No JSON found in AI response.')
  }
}

// Integer → English words (for the "Rupees ..." lines). Handles up to billions.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const SCALES = ['', ' Thousand', ' Million', ' Billion']

function underThousand(n: number): string {
  let s = ''
  if (n >= 100) {
    s += ONES[Math.floor(n / 100)] + ' Hundred'
    n %= 100
    if (n) s += ' '
  }
  if (n >= 20) {
    s += TENS[Math.floor(n / 10)]
    if (n % 10) s += ' ' + ONES[n % 10]
  } else if (n > 0) {
    s += ONES[n]
  }
  return s
}

export function numberToWords(value: number): string {
  let n = Math.round(value)
  if (n === 0) return 'Zero'
  const groups: number[] = []
  while (n > 0) {
    groups.push(n % 1000)
    n = Math.floor(n / 1000)
  }
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i]) parts.push(underThousand(groups[i]) + SCALES[i])
  }
  return parts.join(' ').trim()
}

// "Rupees Twelve Million Three Hundred Thousand only"
export function rupeesInWords(value: number): string {
  return `Rupees ${numberToWords(value)} only`
}
