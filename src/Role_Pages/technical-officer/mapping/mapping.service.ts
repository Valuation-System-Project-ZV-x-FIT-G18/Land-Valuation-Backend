//04
import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'

type Row = Record<string, any>

@Injectable()
export class MappingService {
  private readonly logger = new Logger(MappingService.name)

  constructor(private readonly db: DatabaseService) {}



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
    await this.db.query(
      `UPDATE projects SET latitude = $1, longitude = $2 WHERE project_id = $3`,
      [String(lat), String(lng), p],
    )
    return { ok: true }
  }
}
