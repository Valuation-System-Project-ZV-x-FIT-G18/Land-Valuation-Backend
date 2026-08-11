import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { AiService } from '../../../Common_Pages/ai/ai.service'
import { extentToPerches, formatLKR, parseJsonLoose, rupeesInWords } from './report.util'

type Row = Record<string, any>

export type Comparable = {
  area: string
  refNo: string
  saleDate: string
  extentPerches: number
  distanceKm: number
  pricePerPerch: number
  evidenceType: string // always 'Nearby Comparable Land'
  propertyType: string
  roadAccess: string
  source: string // 'Ikman' | 'LankaPropertyWeb' | 'Homeland'
  note: string
}

export type AnalyseInput = {
  comparables?: Comparable[]
  ratePerPerch?: number
  forcedSalePct?: number
  valuationDate?: string
  previouslyValued?: string
  marketTrend?: string
}

// The market-trend options (must match the frontend dropdown so it can auto-select).
const TRENDS = ['going up steadily', 'staying the same', 'slowing down']


@Injectable()
export class NearbyService implements OnModuleInit {
  private readonly logger = new Logger(NearbyService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.query(`CREATE TABLE IF NOT EXISTS land_analyses (
        id SERIAL PRIMARY KEY, project_id VARCHAR(20) NOT NULL UNIQUE,
        data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
    } catch (err) {
      this.logger.error(`Nearby setup failed: ${(err as Error).message}`)
    }
  }

  private async project(projectId: string): Promise<Row | null> {
    const r = await this.db.query(`SELECT * FROM projects WHERE project_id = $1`, [projectId.trim()])
    const p = r.rows[0]
    if (!p) return null
    p.details = p.details ?? {}
    return p
  }

  // Prefer the dedicated column, fall back to the details JSONB.
  private field(p: Row, key: string, column: string): string {
    const col = p[column]
    if (col !== null && col !== undefined && String(col) !== '') return String(col)
    return String(p.details[key] ?? '')
  }

  // Prefilled location + GPS + extent for the selected project. GPS prefers the
  // officer's saved pin (GPS & Map Integration), then the Create-Project value.
  async location(projectId: string) {
    const p = await this.project(projectId)
    if (!p) return null
    const projLat = parseFloat(this.field(p, 'latitude', 'latitude'))
    const projLng = parseFloat(this.field(p, 'longitude', 'longitude'))

    // The saved pin from the GPS & Map Integration step, if any.
    let lat = Number.isFinite(projLat) ? projLat : null
    let lng = Number.isFinite(projLng) ? projLng : null
    try {
      const m = await this.db.query(
        `SELECT lat, lng FROM map_analyses WHERE project_id = $1`,
        [projectId.trim()],
      )
      const s = m.rows[0]
      if (s?.lat !== null && s?.lat !== undefined) lat = Number(s.lat)
      if (s?.lng !== null && s?.lng !== undefined) lng = Number(s.lng)
    } catch {
      // map_analyses may not exist yet — fall back to the project coordinates.
    }

    return {
      projectId: p.project_id,
      propertyNumber: this.field(p, 'propertyNumber', 'property_number'),
      streetName: this.field(p, 'streetName', 'street_name'),
      villageTown: this.field(p, 'villageTown', 'village_town'),
      district: this.field(p, 'district', 'district'),
      province: this.field(p, 'province', 'province'),
      propertyType: this.field(p, 'propertyType', 'property_type') || 'bare land',
      latitude: Number.isFinite(lat as number) ? lat : null,
      longitude: Number.isFinite(lng as number) ? lng : null,
      extentPerches: extentToPerches(p.details),
    }
  }

  // The nearest suitable land parcels/listings, filtered first by distance,
  // then by recency and similarity to the subject land.
  async comparables(
    projectId: string,
  ): Promise<{ comparables: Comparable[]; aiUsed: boolean; marketTrend: string }> {
    const loc = await this.location(projectId)
    if (!loc) return { comparables: [], aiUsed: false, marketTrend: '' }
    const area = [loc.villageTown, loc.district].filter(Boolean).join(', ') || 'the area'

    // Prefer a dedicated search provider for listing discovery. Unlike Gemini,
    // this remains available when the generative-AI quota is exhausted.
    const serpComparables = await this.searchPropertyPortals(area, loc.latitude, loc.longitude)
    if (serpComparables.length) {
      return { comparables: serpComparables, aiUsed: true, marketTrend: '' }
    }

    if (this.ai.isEnabled()) {
      try {
        const prompt =
          `You are a Sri Lankan property market researcher with live web access. ` +
          `Search Sri Lankan property portals, classified sites and real-estate agent sites for up to three ` +
          `NEARBY COMPARABLE LAND PARCELS for the subject property at ${area}` +
          `${loc.latitude != null && loc.longitude != null ? ` (GPS ${loc.latitude}, ${loc.longitude})` : ''}. ` +
          `The subject is ${loc.propertyType} of approximately ${loc.extentPerches || 'unknown'} perches. ` +
          `Apply these filters in order: (1) closest distance first - preferably within 500 m and never beyond ` +
          `2 km; (2) a current listing or evidence date within the last 2 years; (3) bare/residential land of ` +
          `the same permitted use; (4) similar extent, road access, frontage, ground condition and utilities. ` +
          `Exclude houses, buildings, commercial premises and agricultural land unless clearly comparable. ` +
          `Sort the final results from nearest to farthest and judge the current land market trend. ` +
          `Reject evidence older than 2 years unless no newer evidence exists, in which case clearly state the age ` +
          `and required market-time adjustment in the note. Return STRICT JSON only: an object ` +
          `{"marketTrend": one of "going up steadily"|"staying the same"|"slowing down", ` +
          `"comparables": [ up to 5 objects with keys ` +
          `area, refNo, saleDate (YYYY-MM-DD), extentPerches (number), ` +
          `distanceKm (number from the subject property), pricePerPerch (number in LKR), ` +
          `evidenceType (always "Nearby Comparable Land"), propertyType, roadAccess, ` +
          `source (the ACTUAL website name or full URL where you found this listing), ` +
          `note (short detail) ] }. ` +
          `Use real current listings and their real per-perch prices. No markdown.`
        // useSearch = true → Google Search grounding (real web research).
        const parsed = parseJsonLoose(await this.ai.generate(prompt, [], true))
        const arr = Array.isArray(parsed) ? parsed : (parsed?.comparables ?? [])
        const trend = TRENDS.includes(parsed?.marketTrend) ? parsed.marketTrend : ''
        if (Array.isArray(arr) && arr.length) {
          const now = Date.now()
          const subjectExtent = Number(loc.extentPerches) || 0
          const suitable = arr
            .map((c: Row) => this.clean(c))
            .filter((c: Comparable) => c.distanceKm > 0 && c.distanceKm <= 2)
            .filter((c: Comparable) => /bare|residential|vacant/i.test(c.propertyType))
            .map((c: Comparable) => {
              const ageYears = c.saleDate ? (now - new Date(c.saleDate).getTime()) / 31_557_600_000 : 0
              const distanceScore = c.distanceKm <= 0.5 ? 1_000 - c.distanceKm * 100 : 500 - c.distanceKm * 100
              const recencyScore = !c.saleDate ? 80 : ageYears <= 1 ? 220 : ageYears <= 2 ? 100 : -500
              const typeScore = /bare|vacant/i.test(c.propertyType) ? 260 : /residential/i.test(c.propertyType) ? 220 : 0
              const extentScore = subjectExtent > 0 && c.extentPerches > 0
                ? Math.max(0, 120 - Math.abs(c.extentPerches - subjectExtent) / subjectExtent * 120)
                : 0
              const accessScore = c.roadAccess ? 40 : 0
              return { comparable: c, score: distanceScore + recencyScore + typeScore + extentScore + accessScore }
            })
            .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
            .slice(0, 3)
            .map((ranked: { comparable: Comparable }) => ranked.comparable)
          if (suitable.length) return { comparables: suitable, aiUsed: true, marketTrend: trend }
        }
      } catch (err) {
        this.logger.error(`Nearby comparables AI failed: ${(err as Error).message}`)
      }
    }
    // Never manufacture five empty "results". An unavailable search returns an
    // honest empty state; the officer may then add a verified land individually.
    return { comparables: [], aiUsed: false, marketTrend: '' }
  }

  private async searchPropertyPortals(area: string, subjectLat: number | null, subjectLng: number | null): Promise<Comparable[]> {
    const key = process.env.SERPAPI_API_KEY
    if (!key) return []

    const queries = [
      `site:ikman.lk/en/ad land for sale "${area}" "per perch"`,
      `site:lankapropertyweb.com land for sale "${area}" "per perch"`,
    ]

    try {
      const responses = await Promise.all(queries.map(async (q) => {
        const params = new URLSearchParams({ engine: 'google', q, gl: 'lk', hl: 'en', api_key: key })
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 20_000)
        try {
          const response = await fetch(`https://serpapi.com/search.json?${params}`, { signal: controller.signal })
          const body = await response.json() as { error?: string; organic_results?: Row[] }
          if (!response.ok || body.error) throw new Error(body.error || `HTTP ${response.status}`)
          return body.organic_results ?? []
        } finally {
          clearTimeout(timeout)
        }
      }))

      const seen = new Set<string>()
      const candidates = responses.flat()
        .filter((result) => /ikman\.lk|lankapropertyweb\.com/i.test(String(result.link ?? '')))
        .filter((result) => {
          const link = String(result.link ?? '')
          if (!link || seen.has(link)) return false
          seen.add(link)
          return true
        })
      const mapped = await Promise.all(candidates.slice(0, 8).map(async (result) => {
        const comparable = this.comparableFromSearchResult(result, area)
        comparable.distanceKm = await this.distanceFromSubject(
          comparable.area, subjectLat, subjectLng,
        )
        return comparable
      }))
      const uniqueLands = new Map<string, Comparable>()
      for (const comparable of mapped) {
        const normalizedArea = comparable.area
          .toLowerCase()
          .replace(/\b(?:land|for|sale)\b/g, '')
          .replace(/[^a-z0-9]+/g, '')
        // Portal search results can expose the same advertisement through
        // multiple URLs. Treat matching locality, extent and price as one land.
        const fingerprint = [
          normalizedArea,
          comparable.extentPerches || '',
          comparable.pricePerPerch || '',
        ].join('|')
        if (!uniqueLands.has(fingerprint)) uniqueLands.set(fingerprint, comparable)
      }

      return [...uniqueLands.values()]
        .filter((result) => result.pricePerPerch > 0 || result.extentPerches > 0)
        .sort((a, b) => {
          if (a.distanceKm && b.distanceKm) return a.distanceKm - b.distanceKm
          if (a.distanceKm) return -1
          if (b.distanceKm) return 1
          return 0
        })
        .slice(0, 3)
    } catch (error) {
      this.logger.error(`SerpApi property search failed: ${(error as Error).message}`)
      return []
    }
  }

  private comparableFromSearchResult(result: Row, fallbackArea: string): Comparable {
    const title = String(result.title ?? '')
    const snippet = String(result.snippet ?? '')
    const text = `${title} ${snippet}`
    const number = (value: string) => Number(value.replace(/,/g, '')) || 0
    const priceMatch = text.match(/(?:rs\.?|lkr)\s*([\d,]+(?:\.\d+)?)\s*(?:\/-)?\s*(?:per\s*)?perch/i)
      ?? text.match(/([\d,]+(?:\.\d+)?)\s*(?:lakh|lakhs)\s*(?:per\s*)?perch/i)
    const extentMatch = text.match(/(?:land\s*size\s*:\s*)?([\d,.]+)\s*(perch(?:es)?|acre(?:s)?|rood(?:s)?|hectare(?:s)?)\b/i)
    const isLakhs = !!priceMatch && /lakh/i.test(priceMatch[0])
    const link = String(result.link ?? '')
    const displayedDate = String(result.date ?? '')
    const parsedDate = displayedDate ? new Date(displayedDate) : null

    return {
      area: title.replace(/\s*[-|].*$/, '').trim() || fallbackArea,
      refNo: link,
      saleDate: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : '',
      extentPerches: extentMatch ? this.extentInPerches(number(extentMatch[1]), extentMatch[2]) : 0,
      distanceKm: 0,
      pricePerPerch: priceMatch ? number(priceMatch[1]) * (isLakhs ? 100_000 : 1) : 0,
      evidenceType: 'Nearby Comparable Land',
      propertyType: 'Bare / Residential Land',
      roadAccess: '',
      source: link,
      note: `${snippet}${snippet ? ' ' : ''}Distance and listing details require valuer verification.`,
    }
  }

  private extentInPerches(value: number, unit: string): number {
    if (/acre/i.test(unit)) return Math.round(value * 160 * 100) / 100
    if (/rood/i.test(unit)) return Math.round(value * 40 * 100) / 100
    if (/hectare/i.test(unit)) return Math.round(value * 395.36861 * 100) / 100
    return value
  }

  private async distanceFromSubject(area: string, subjectLat: number | null, subjectLng: number | null): Promise<number> {
    if (subjectLat == null || subjectLng == null || !area) return 0
    try {
      const place = area
        .replace(/^land\s+for\s+sale\s*/i, '')
        // Common listing spelling; OpenStreetMap records the official locality
        // spelling as Kahandamodara.
        .replace(/kahadamodara/ig, 'Kahandamodara')
        .trim()
      const words = place.split(/\s+/)
      const queries = [place, ...(words.length > 2 ? [words.slice(0, -1).join(' ')] : [])]
      let lat = NaN
      let lng = NaN
      for (const query of queries) {
        const params = new URLSearchParams({
          format: 'jsonv2', q: `${query}, Sri Lanka`, countrycodes: 'lk', limit: '1',
        })
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { 'User-Agent': 'CODEHUB-Land-Valuation/1.0' },
        })
        if (!response.ok) continue
        const results = await response.json() as { lat: string; lon: string }[]
        lat = Number(results[0]?.lat)
        lng = Number(results[0]?.lon)
        if (Number.isFinite(lat) && Number.isFinite(lng)) break
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0
      const radians = (degrees: number) => degrees * Math.PI / 180
      const dLat = radians(lat - subjectLat)
      const dLng = radians(lng - subjectLng)
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(subjectLat)) * Math.cos(radians(lat)) * Math.sin(dLng / 2) ** 2
      return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100
    } catch {
      return 0
    }
  }

  // The latest valuation's saved details (holds valuationPurpose, loanPurpose, …).
  private async latestValuationDetails(projectId: string): Promise<Row> {
    try {
      const r = await this.db.query(
        `SELECT details FROM valuations WHERE project_id = $1 ORDER BY valuation_id DESC LIMIT 1`,
        [projectId.trim()],
      )
      return (r.rows[0]?.details ?? {}) as Row
    } catch {
      return {}
    }
  }

  private clean(c: Row): Comparable {
    return {
      area: String(c.area ?? ''),
      refNo: String(c.refNo ?? ''),
      saleDate: String(c.saleDate ?? ''),
      extentPerches: Number(c.extentPerches) || 0,
      distanceKm: Number(c.distanceKm) || 0,
      pricePerPerch: Number(c.pricePerPerch) || 0,
      evidenceType: 'Nearby Comparable Land',
      propertyType: String(c.propertyType ?? 'Bare / Residential Land'),
      roadAccess: String(c.roadAccess ?? ''),
      source: String(c.source ?? ''), // free text — the actual source found
      note: String(c.note ?? ''),
    }
  }

  // Build report Sections 9–13: deterministic money maths + AI narrative.
  async analyse(projectId: string, input: AnalyseInput) {
    const loc = await this.location(projectId)
    if (!loc) return { error: 'Project not found.' }

    const comps = (input.comparables ?? []).map((c) => this.clean(c))
    const prices = comps.map((c) => c.pricePerPerch).filter((n) => n > 0)
    const rangeLow = prices.length ? Math.min(...prices) : 0
    const rangeHigh = prices.length ? Math.max(...prices) : 0
    const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0

    const extent = loc.extentPerches
    const rate = Number(input.ratePerPerch) || avg
    // Guard against silently generating a "Rs. 0" valuation (Sections 9, 11,
    // 12 & 13 all derive from `extent` and `rate` — if either is zero, every
    // figure in those sections comes out zero too).
    if (extent <= 0) {
      return {
        error:
          'This project has no recorded land extent (Section 8 — Land Extent, in Create Project). ' +
          'Please have the coordinator update it before the valuation can be calculated.',
      }
    }
    if (rate <= 0) {
      return {
        error:
          'Enter a price per perch for at least one comparable, or set the adopted rate manually, ' +
          'before generating the valuation sections — none of the comparables have a value yet.',
      }
    }
    const marketValue = Math.round(extent * rate)
    const pct = Number(input.forcedSalePct) || 80
    const forcedSaleValue = Math.round((marketValue * pct) / 100)
    const trend = input.marketTrend || 'staying the same'
    const prev = input.previouslyValued || 'not valued'
    const date = input.valuationDate || new Date().toISOString().slice(0, 10)

    const narrative = await this.narrative(loc, comps, { rangeLow, rangeHigh, rate, marketValue, trend })

    // Build the "basis" sentence from THIS project's facts so it reads
    // differently per property (type, address, extent, purpose) — not fixed text.
    const propType = String(loc.propertyType || 'bare land').toLowerCase()
    const address = [loc.propertyNumber, loc.streetName, loc.villageTown, loc.district]
      .filter(Boolean).join(', ')
    const vdetails = await this.latestValuationDetails(projectId)
    const purpose = String(vdetails.valuationPurpose || vdetails.loanPurpose || '').trim()
    const asIsNote =
      `I have undertaken to provide an assessment of the current Market Value of the ${propType}` +
      `${propType.includes('land') ? '' : ' bare land'}` +
      `${address ? ` situated at ${address}` : ''}` +
      `${extent ? `, extending to ${extent} perches,` : ''}` +
      `${purpose ? ` for the purpose of ${purpose},` : ''}` +
      ` on an 'as is where is' basis, using the direct comparison method.`

    return {
      evidence: { comparables: comps, rangeLow, rangeHigh, marketSurveyStatement: narrative.marketSurveyStatement },
      basis: {
        asIsNote,
        previouslyValued: prev,
      },
      calculation: {
        totalExtentPerches: extent,
        ratePerPerch: rate,
        bareLandValue: marketValue,
        marketValue,
        notes: [
          `The size of the land is ${extent} perches.`,
          'We checked how much other empty lands sold for nearby.',
          'People really want to buy land in this area to build houses.',
          `Because of this, pricing the land at ${formatLKR(rate)} for one perch is fair and correct for today's market.`,
        ],
      },
      conclusion: { marketTrend: trend, text: narrative.conclusion },
      summary: {
        valuationDate: date,
        marketValue,
        marketValueWords: rupeesInWords(marketValue),
        forcedSalePct: pct,
        forcedSaleValue,
        forcedSaleValueWords: rupeesInWords(forcedSaleValue),
      },
      aiUsed: narrative.aiUsed,
    }
  }

  private async narrative(
    loc: Row,
    comps: Comparable[],
    n: { rangeLow: number; rangeHigh: number; rate: number; marketValue: number; trend: string },
  ): Promise<{ marketSurveyStatement: string; conclusion: string; aiUsed: boolean }> {
    const area = [loc.villageTown, loc.district].filter(Boolean).join(', ') || 'the area'
    if (this.ai.isEnabled()) {
      try {
        const facts = {
          location: area,
          propertyType: loc.propertyType,
          extentPerches: loc.extentPerches,
          adoptedRatePerPerch: n.rate,
          marketValue: n.marketValue,
          comparableRangePerPerch: [n.rangeLow, n.rangeHigh],
          comparables: comps.map((c) => ({ area: c.area, pricePerPerch: c.pricePerPerch, type: c.evidenceType, source: c.source, distanceKm: c.distanceKm })),
          marketTrend: n.trend,
        }
        const prompt =
          `You are a senior Sri Lankan chartered valuer. Using ONLY the facts, return STRICT JSON ` +
          `{"marketSurveyStatement":"...","conclusion":"..."}.\n` +
          `- marketSurveyStatement: one sentence "My market survey indicates that bare land values in this specific neighborhood currently range from Rs. X to Rs. Y per perch."\n` +
          `- conclusion: 2-3 sentences on the market trend and the concluded market value, professional tone.\n` +
          `No markdown.\n\nFACTS:\n${JSON.stringify(facts)}`
        const parsed = parseJsonLoose(await this.ai.generate(prompt))
        if (parsed.marketSurveyStatement && parsed.conclusion) return { ...parsed, aiUsed: true }
      } catch (err) {
        this.logger.error(`Nearby AI narrative failed: ${(err as Error).message}`)
      }
    }
    return {
      marketSurveyStatement: `My market survey indicates that bare land values in this specific neighborhood currently range from ${formatLKR(n.rangeLow)} to ${formatLKR(n.rangeHigh)} per perch.`,
      conclusion: `The real estate market for bare land around this property is ${n.trend}. Having considered the land's shape, location and current comparable evidence, and applying the comparison method, I have determined the current Market Value to be ${formatLKR(n.marketValue)}.`,
      aiUsed: false,
    }
  }

  async getAnalysis(projectId: string) {
    const r = await this.db.query(`SELECT data FROM land_analyses WHERE project_id = $1`, [projectId.trim()])
    return r.rows[0]?.data ?? null
  }

  async saveAnalysis(projectId: string, data: Row) {
    const p = (projectId ?? '').trim()
    if (!p) return { ok: false, error: 'Missing project.' }
    await this.db.query(
      `INSERT INTO land_analyses (project_id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (project_id) DO UPDATE SET data = EXCLUDED.data, created_at = now()`,
      [p, JSON.stringify(data ?? {})],
    )
    return { ok: true }
  }
}
