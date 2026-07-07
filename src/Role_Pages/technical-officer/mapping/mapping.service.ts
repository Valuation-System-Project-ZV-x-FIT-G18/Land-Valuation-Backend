import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { AiService } from '../../../Common_Pages/ai/ai.service'

type Row = Record<string, any>

// The inspection "Access & Location" fields used for the access description.
const ACCESS_KEYS = ['accessRoute', 'roadWidth', 'roadType', 'roadFacing', 'distanceFromNearestCity', 'rightOfWay']
// The inspection "Locality Description" fields used for the locality description.
const LOCALITY_KEYS = ['vicinityCharacter', 'nearbyFacilities', 'transportFrequency', 'dayToDayNeeds']

@Injectable()
export class MappingService implements OnModuleInit {
  private readonly logger = new Logger(MappingService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.query(`CREATE TABLE IF NOT EXISTS map_analyses (
        id SERIAL PRIMARY KEY, project_id VARCHAR(20) NOT NULL UNIQUE,
        lat DOUBLE PRECISION, lng DOUBLE PRECISION, access_description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
      await this.db.query(
        `ALTER TABLE map_analyses ADD COLUMN IF NOT EXISTS locality_description TEXT`,
      )
      await this.db.query(
        `ALTER TABLE map_analyses ADD COLUMN IF NOT EXISTS access_sources JSONB DEFAULT '[]'::jsonb`,
      )
      await this.db.query(
        `ALTER TABLE map_analyses ADD COLUMN IF NOT EXISTS locality_sources JSONB DEFAULT '[]'::jsonb`,
      )
    } catch (err) {
      this.logger.error(`Mapping setup failed: ${(err as Error).message}`)
    }
  }

  private async project(projectId: string): Promise<Row | null> {
    const r = await this.db.query(`SELECT * FROM projects WHERE project_id = $1`, [projectId.trim()])
    const p = r.rows[0]
    if (!p) return null
    p.details = p.details ?? {}
    return p
  }

  private field(p: Row, key: string, column: string): string {
    const col = p[column]
    if (col !== null && col !== undefined && String(col) !== '') return String(col)
    return String(p.details[key] ?? '')
  }

  // Prefilled location: prefer the officer's saved pin, else the coordinator's
  // Create-Project coordinates.
  async location(projectId: string) {
    const p = await this.project(projectId)
    if (!p) return null
    const saved = await this.db.query(
      `SELECT lat, lng, access_description, locality_description, access_sources, locality_sources
         FROM map_analyses WHERE project_id = $1`,
      [projectId.trim()],
    )
    const s = saved.rows[0]
    const projLat = parseFloat(this.field(p, 'latitude', 'latitude'))
    const projLng = parseFloat(this.field(p, 'longitude', 'longitude'))
    const lat = s?.lat ?? (Number.isFinite(projLat) ? projLat : null)
    const lng = s?.lng ?? (Number.isFinite(projLng) ? projLng : null)
    return {
      projectId: p.project_id,
      address: [this.field(p, 'propertyNumber', 'property_number'), this.field(p, 'streetName', 'street_name'), this.field(p, 'villageTown', 'village_town')]
        .filter(Boolean).join(', '),
      nearestCity: this.field(p, 'villageTown', 'village_town'),
      district: this.field(p, 'district', 'district'),
      latitude: lat,
      longitude: lng,
      accessDescription: s?.access_description ?? '',
      localityDescription: s?.locality_description ?? '',
      accessSources: (s?.access_sources as string[]) ?? [],
      localitySources: (s?.locality_sources as string[]) ?? [],
    }
  }

  private async inspectionFields(projectId: string, keys: string[]): Promise<Row> {
    const r = await this.db.query(`SELECT data FROM inspections WHERE project_id = $1`, [projectId.trim()])
    const data = (r.rows[0]?.data ?? {}) as Row
    const out: Row = {}
    for (const k of keys) out[k] = String(data[k] ?? '')
    return out
  }

  private accessData(projectId: string) {
    return this.inspectionFields(projectId, ACCESS_KEYS)
  }

  // Locality fields from the coordinator's Create-Project form (mostly `details`).
  private async localityData(projectId: string): Promise<Row> {
    const p = await this.project(projectId)
    if (!p) return {}
    const g = (key: string, col = key) => this.field(p, key, col)
    return {
      address: [g('propertyNumber', 'property_number'), g('streetName', 'street_name'), g('villageTown', 'village_town')]
        .filter(Boolean).join(', '),
      city: g('villageTown', 'village_town'),
      district: g('district', 'district'),
      province: g('province'),
      landName: g('landTraditionalName'),
      localAuthorityType: g('localAuthorityType'),
      localAuthorityName: g('localAuthorityName'),
      pattu: g('pattu'),
      korale: g('korale'),
      propertyType: g('propertyType'),
    }
  }

  // Free reverse-geocoding (OpenStreetMap Nominatim) — turns the chosen pin into
  // real map facts about the surrounding area. Returns null on any failure.
  private async reverseGeocode(lat: number, lng: number) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`
      const res = await fetch(url, { headers: { 'User-Agent': 'CODEHUB-Land-Valuation/1.0' } })
      if (!res.ok) return null
      const j: any = await res.json()
      if (!j || j.error) return null
      const a = j.address ?? {}
      const nearbyPlace = a.suburb || a.village || a.town || a.neighbourhood || a.city || ''
      return { displayName: (j.display_name as string) ?? '', nearbyPlace, address: a as Row }
    } catch (err) {
      this.logger.warn(`Reverse geocode failed: ${(err as Error).message}`)
      return null
    }
  }

  // Turn labelled facts into a readable "sources" list (skips empty values).
  private sourceList(entries: [string, unknown][]): string[] {
    return entries
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
      .map(([label, v]) => `${label}: ${String(v).trim()}`)
  }

  // AI-written route description from the nearest city, using the inspection
  // Access & Location data (form) + the chosen coordinates & map data.
  async generateAccess(projectId: string, lat: number, lng: number) {
    const loc = await this.location(projectId)
    if (!loc) return { text: '', aiUsed: false, sources: [] as string[] }
    const access = await this.accessData(projectId)
    const geo = await this.reverseGeocode(lat, lng)
    const nearestCity = loc.nearestCity || loc.district || 'the nearest town'

    // What went into the description — shown to the officer as sources.
    const sources = this.sourceList([
      ['Nearest city (project)', nearestCity],
      ['District (project)', loc.district],
      ['Address (project)', loc.address],
      ['Access route (inspection)', access.accessRoute],
      ['Road width (inspection)', access.roadWidth],
      ['Road type (inspection)', access.roadType],
      ['Road facing (inspection)', access.roadFacing],
      ['Distance from city (inspection)', access.distanceFromNearestCity],
      ['Right of way (inspection)', access.rightOfWay],
      ['GPS coordinates (map)', `${lat}, ${lng}`],
      ['Map locality (OpenStreetMap)', geo?.displayName],
    ])

    if (this.ai.isEnabled()) {
      try {
        const facts = {
          nearestCity, district: loc.district, gps: { lat, lng }, address: loc.address,
          mapLocality: geo?.displayName, ...access,
        }
        const prompt =
          `You are a senior Sri Lankan land valuer. Write a strong, detailed paragraph describing ` +
          `how to travel from ${nearestCity} to the subject property. Describe the route road by road, ` +
          `the road type and width, notable places/landmarks passed along the way, and the left/right ` +
          `turns with approximate distances, ending at the property. Base it on these facts, the given ` +
          `coordinates and the OpenStreetMap locality; be specific and professional, but do not invent ` +
          `exact business names that are not implied. Output ONLY the paragraph, no heading.\n\nFACTS:\n${JSON.stringify(facts)}`
        const text = (await this.ai.generate(prompt)).trim()
        if (text) return { text, aiUsed: true, sources }
      } catch (err) {
        this.logger.error(`Access description AI failed: ${(err as Error).message}`)
      }
    }

    // Fallback: compose from the raw fields.
    const parts = [`The property is located approximately ${access.distanceFromNearestCity || 'a short distance'} from ${nearestCity}.`]
    if (access.accessRoute) parts.push(access.accessRoute)
    if (access.roadType || access.roadWidth)
      parts.push(`The final access road is ${[access.roadWidth, access.roadType].filter(Boolean).join(' ')}.`)
    if (access.roadFacing) parts.push(`The property faces the road on its ${access.roadFacing} side.`)
    if (access.rightOfWay) parts.push(`Right of way: ${access.rightOfWay}.`)
    return { text: parts.join(' '), aiUsed: false, sources }
  }

  // AI-written locality/neighbourhood description, using the Create-Project form
  // + inspection Locality Description + the chosen coordinates & map data.
  async generateLocality(projectId: string, lat: number, lng: number) {
    const f = await this.localityData(projectId)
    const insp = await this.inspectionFields(projectId, LOCALITY_KEYS)
    const geo = await this.reverseGeocode(lat, lng)

    const sources = this.sourceList([
      ['Address (project)', f.address],
      ['City / Town (project)', f.city],
      ['District (project)', f.district],
      ['Province (project)', f.province],
      ['Land name (project)', f.landName],
      ['Local authority (project)', [f.localAuthorityName, f.localAuthorityType].filter(Boolean).join(' ')],
      ['Pattu / Korale (project)', [f.pattu && `${f.pattu} Pattu`, f.korale && `${f.korale} Korale`].filter(Boolean).join(', ')],
      ['Property type (project)', f.propertyType],
      ['Vicinity character (inspection)', insp.vicinityCharacter],
      ['Nearby facilities (inspection)', insp.nearbyFacilities],
      ['Transport frequency (inspection)', insp.transportFrequency],
      ['Day-to-day needs (inspection)', insp.dayToDayNeeds],
      ['GPS coordinates (map)', `${lat}, ${lng}`],
      ['Map locality (OpenStreetMap)', geo?.displayName],
    ])

    if (this.ai.isEnabled()) {
      try {
        const facts = { ...f, ...insp, gps: { lat, lng }, mapLocality: geo?.displayName, mapNearbyPlace: geo?.nearbyPlace }
        const prompt =
          `You are a senior Sri Lankan land valuer. Write a professional "Locality Description" paragraph ` +
          `for a valuation report: describe the character of the surrounding neighbourhood, the administrative ` +
          `area (local authority, district, province, pattu/korale), the type of development around the property, ` +
          `nearby facilities and amenities, transport and general accessibility of day-to-day needs. Base it ONLY ` +
          `on these facts, the coordinates and the OpenStreetMap locality; be specific and professional and do not ` +
          `invent facilities that are not implied. Output ONLY the paragraph, no heading.\n\nFACTS:\n${JSON.stringify(facts)}`
        const text = (await this.ai.generate(prompt)).trim()
        if (text) return { text, aiUsed: true, sources }
      } catch (err) {
        this.logger.error(`Locality description AI failed: ${(err as Error).message}`)
      }
    }

    // Fallback: compose from the raw fields.
    const named = f.landName ? `The land traditionally known as "${f.landName}" ` : 'The property '
    const parts = [
      `${named}${f.propertyType ? `(a ${f.propertyType}) ` : ''}is situated at ${f.address || '—'}, within the ${f.district || '—'} district of the ${f.province || '—'} province.`,
    ]
    if (f.localAuthorityName || f.localAuthorityType)
      parts.push(`The area is administered by the ${[f.localAuthorityName, f.localAuthorityType].filter(Boolean).join(' ')}.`)
    if (insp.vicinityCharacter) parts.push(insp.vicinityCharacter)
    if (insp.nearbyFacilities) parts.push(`Nearby facilities include ${insp.nearbyFacilities}.`)
    if (insp.transportFrequency) parts.push(`Public transport is ${insp.transportFrequency}.`)
    return { text: parts.join(' '), aiUsed: false, sources }
  }

  async get(projectId: string) {
    const r = await this.db.query(
      `SELECT lat, lng, access_description AS "accessDescription",
              locality_description AS "localityDescription",
              access_sources AS "accessSources", locality_sources AS "localitySources"
         FROM map_analyses WHERE project_id = $1`,
      [projectId.trim()],
    )
    return r.rows[0] ?? null
  }

  async save(
    projectId: string,
    lat: number,
    lng: number,
    accessDescription: string,
    localityDescription: string,
    accessSources: string[],
    localitySources: string[],
  ) {
    const p = (projectId ?? '').trim()
    if (!p) return { ok: false, error: 'Missing project.' }
    const aSrc = JSON.stringify(Array.isArray(accessSources) ? accessSources : [])
    const lSrc = JSON.stringify(Array.isArray(localitySources) ? localitySources : [])
    await this.db.query(
      `INSERT INTO map_analyses
         (project_id, lat, lng, access_description, locality_description, access_sources, locality_sources)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
       ON CONFLICT (project_id) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng,
         access_description = EXCLUDED.access_description,
         locality_description = EXCLUDED.locality_description,
         access_sources = EXCLUDED.access_sources,
         locality_sources = EXCLUDED.locality_sources, created_at = now()`,
      [p, Number(lat) || null, Number(lng) || null, accessDescription ?? '', localityDescription ?? '', aSrc, lSrc],
    )
    return { ok: true }
  }
}
