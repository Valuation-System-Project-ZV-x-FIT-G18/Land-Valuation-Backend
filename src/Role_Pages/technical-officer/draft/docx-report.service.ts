//03
import { Injectable } from '@nestjs/common'
import { readFile } from 'fs/promises'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
// This module has no maintained TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ImageModule = require('docxtemplater-image-module-free')
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'
import { LAND_ONLY_REPORT_TEMPLATE_PATH } from './template-path'
import { DraftService } from './draft.service'

type ImageValue = { data: Buffer; size: [number, number] }

const IMAGE_SLOTS = [
  'surveyPlanImage', 'satelliteLocationImage', 'locationMapImage',
  'photoAccessRoad', 'photoRouteFromMainRoad', 'photoFrontView', 'photoRearView',
  'photoLeftSide', 'photoRightSide', 'photoNorthBoundary', 'photoEastBoundary',
  'photoSouthBoundary', 'photoWestBoundary', 'photoGateEntrance', 'photoDrainage',
  'photoRoadFrontage', 'photoSoilCondition', 'photoUnauthorizedStructures',
  'photoFloodEvidence', 'photoNotableFeatures', 'photoSurroundingArea',
  'photoNearbyFacilities',
] as const

const PHOTO_SLOT_TYPES: Record<string, string> = {
  photoAccessRoad: 'accessRoad', photoRouteFromMainRoad: 'routeFromMainRoad',
  photoFrontView: 'frontView', photoRearView: 'rearView', photoLeftSide: 'leftSideView',
  photoRightSide: 'rightSideView', photoNorthBoundary: 'northBoundary',
  photoEastBoundary: 'eastBoundary', photoSouthBoundary: 'southBoundary',
  photoWestBoundary: 'westBoundary', photoGateEntrance: 'gateEntrance',
  photoDrainage: 'drainage', photoRoadFrontage: 'roadFrontage',
  photoSoilCondition: 'soilCondition', photoUnauthorizedStructures: 'unauthorizedStructures',
  photoFloodEvidence: 'floodEvidence', photoNotableFeatures: 'notableFeatures',
  photoSurroundingArea: 'surroundingArea', photoNearbyFacilities: 'nearbyFacilities',
}

@Injectable()
export class DocxReportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: ObjectStorageService,
    private readonly drafts: DraftService,
  ) {}

  private async storedImage(sql: string, params: unknown[]): Promise<Buffer | null> {
    const row = (await this.db.query(sql, params)).rows[0]
    if (!row) return null
    const mime = String(row.mime ?? row.file_mime ?? '').toLowerCase()
    if (!mime.startsWith('image/')) return null
    const fromStorage = await this.storage.read(String(row.object_key ?? ''))
    return fromStorage ?? (row.file_data ? Buffer.from(row.file_data) : null)
  }

  private projectImage(projectId: string, type: string) {
    return this.storedImage(
      `SELECT mime, object_key, file_data FROM project_files
        WHERE project_id = $1 AND file_type = $2 ORDER BY id DESC LIMIT 1`,
      [projectId, type],
    )
  }

  private siteImage(projectId: string, type: string) {
    return this.storedImage(
      `SELECT file_mime, object_key, file_data FROM site_photos
        WHERE project_id = $1 AND photo_type = $2 LIMIT 1`,
      [projectId, type],
    )
  }

  private async remoteImage(url: string): Promise<Buffer | null> {
    if (!/^https:\/\//i.test(url)) return null
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
      const mime = response.headers.get('content-type') ?? ''
      if (!response.ok || !mime.toLowerCase().startsWith('image/')) return null
      return Buffer.from(await response.arrayBuffer())
    } catch {
      return null
    }
  }

  private async images(projectId: string, values: Record<string, string>) {
    const result: Record<string, ImageValue | null> = {}
    result.surveyPlanImage = await this.projectImage(projectId, 'surveyPlan')
      .then((data) => data ? ({ data, size: [430, 560] } as ImageValue) : null)
    result.satelliteLocationImage = await this.remoteImage(values.satelliteLocationImage)
      .then((data) => data ? ({ data, size: [390, 280] } as ImageValue) : null)
    result.locationMapImage = await this.remoteImage(values.locationMapImage)
      .then((data) => data ? ({ data, size: [390, 280] } as ImageValue) : null)
    await Promise.all(Object.entries(PHOTO_SLOT_TYPES).map(async ([slot, type]) => {
      const data = await this.siteImage(projectId, type)
      result[slot] = data ? { data, size: [230, 160] } : null
    }))
    return result
  }

  async generate(projectId: string): Promise<Buffer | null> {
    const id = projectId.trim()
    const values = await this.drafts.buildValues(id)
    if (!values) return null
    const imageValues = await this.images(id, values)
    const template = await readFile(LAND_ONLY_REPORT_TEMPLATE_PATH)
    const zip = new PizZip(template)

    // Image-module tags use {%name}; the authored template intentionally uses
    // the same {name} syntax for every slot, so convert only known image slots.
    for (const name of zip.file(/word\/.*\.xml$/).map((f) => f.name)) {
      let xml = zip.file(name)?.asText() ?? ''
      for (const slot of IMAGE_SLOTS) xml = xml.replaceAll(`{${slot}}`, `{%${slot}}`)
      zip.file(name, xml)
    }

    const imageModule = new ImageModule({
      centered: true,
      getImage: (value: ImageValue) => value.data,
      getSize: (value: ImageValue) => value.size,
    })
    const doc = new Docxtemplater(zip, {
      modules: [imageModule], paragraphLoop: true, linebreaks: true,
      nullGetter: () => '[To be filled]',
    })
    const data: Record<string, string | ImageValue | null> = {}
    for (const [key, value] of Object.entries(values)) data[key] = value?.trim() ? value : '[To be filled]'
    for (const slot of IMAGE_SLOTS) data[slot] = imageValues[slot] ?? null
    doc.render(data)
    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  }
}
