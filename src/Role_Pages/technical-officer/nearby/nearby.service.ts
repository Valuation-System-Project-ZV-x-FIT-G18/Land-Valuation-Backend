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
  evidenceType: string // 'Recent Land Sale' | 'Current Market Asking Price'
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

  // The 5 nearest comparable land listings, researched from ACROSS THE WEB via
  // Google-Search-grounded AI. Each result keeps the actual source it was found
  // on (a site name or URL). All fields are editable afterwards.
  async comparables(
    projectId: string,
  ): Promise<{ comparables: Comparable[]; aiUsed: boolean; marketTrend: string }> {
    const loc = await this.location(projectId)
    if (!loc) return { comparables: [], aiUsed: false, marketTrend: '' }
    const area = [loc.villageTown, loc.district].filter(Boolean).join(', ') || 'the area'

    if (this.ai.isEnabled()) {
      try {
        const prompt =
          `You are a Sri Lankan property market researcher with live web access. ` +
          `Search the whole internet — ANY Sri Lankan property portal, classified or agent site ` +
          `(e.g. ikman.lk, lankapropertyweb.com, patpat.lk, lamudi, house.lk, real-estate agents, news) — ` +
          `for the 5 NEAREST and most relevant CURRENT land price evidences for a ${loc.propertyType} ` +
          `of about ${loc.extentPerches || 'unknown'} perches in ${area}, and judge the current land ` +
          `market trend of that area. ` +
          `Return STRICT JSON only: an object ` +
          `{"marketTrend": one of "going up steadily"|"staying the same"|"slowing down", ` +
          `"comparables": [ up to 5 objects with keys ` +
          `area, refNo, saleDate (YYYY-MM-DD, or "" for a current asking price), extentPerches (number), ` +
          `distanceKm (number, approx km from ${area}), pricePerPerch (number in LKR), ` +
          `evidenceType ("Recent Land Sale" or "Current Market Asking Price"), ` +
          `source (the ACTUAL website name or full URL where you found this listing), ` +
          `note (short detail) ] }. ` +
          `Use real current listings and their real per-perch prices. No markdown.`
        // useSearch = true → Google Search grounding (real web research).
        const parsed = parseJsonLoose(await this.ai.generate(prompt, [], true))
        const arr = Array.isArray(parsed) ? parsed : (parsed?.comparables ?? [])
        const trend = TRENDS.includes(parsed?.marketTrend) ? parsed.marketTrend : ''
        if (Array.isArray(arr) && arr.length) {
          return { comparables: arr.slice(0, 5).map((c: Row) => this.clean(c)), aiUsed: true, marketTrend: trend }
        }
      } catch (err) {
        this.logger.error(`Nearby comparables AI failed: ${(err as Error).message}`)
      }
    }
    // Fallback: 5 blank rows for manual entry (officer fills the source).
    const blanks = Array.from({ length: 5 }, () => this.clean({}))
    return { comparables: blanks, aiUsed: false, marketTrend: '' }
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
      evidenceType: c.evidenceType === 'Current Market Asking Price' ? c.evidenceType : 'Recent Land Sale',
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
