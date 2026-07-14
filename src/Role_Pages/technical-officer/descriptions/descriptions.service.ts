import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { readFile } from 'fs/promises'
import { extname, join } from 'path'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { AiService } from '../../../Common_Pages/ai/ai.service'

const uploadDir = join(process.cwd(), 'uploads')
type Row = Record<string, any>

// Which data source each field is read from.
type Field = { key: string; label: string; from: 'details' | 'inspection' | 'applicant' | 'bank' }
type TextSection =
  | 'landDescription'
  | 'localityDescription'
  | 'localityFacilities'
  | 'legalParagraph'
  | 'localAuthorityTax'
  | 'streetLineBuildingLimits'
  | 'mandatoryRequirements'
  | 'conclusion'

const LABELS: Record<TextSection | 'imageAnalysis', string> = {
  landDescription: 'Land Description',
  localityDescription: 'Locality Description',
  localityFacilities: 'Locality Facilities',
  legalParagraph: 'Legal Paragraph',
  localAuthorityTax: 'Local Authority Tax',
  streetLineBuildingLimits: 'Street Line & Building Limits',
  mandatoryRequirements: 'Mandatory Requirements & Planning Regulations',
  conclusion: 'Conclusion',
  imageAnalysis: 'Image Analysis',
}

// The source fields that feed each descriptive section (shown + editable in the UI).
const SECTION_FIELDS: Record<TextSection, Field[]> = {
  // Built ONLY from the inspection form's "Description of the Land" section.
  landDescription: [
    { key: 'landShape', label: 'Shape of land', from: 'inspection' },
    { key: 'landPosition', label: 'Land position relative to road', from: 'inspection' },
    { key: 'frontage', label: 'Frontage measurement (ft)', from: 'inspection' },
    { key: 'floodProne', label: 'Flood prone status', from: 'inspection' },
    { key: 'boundariesMarked', label: 'Boundaries clearly marked on ground', from: 'inspection' },
    { key: 'soilType', label: 'Soil type', from: 'inspection' },
    { key: 'drainage', label: 'Rainwater drainage method', from: 'inspection' },
    { key: 'garbage', label: 'Garbage disposal method', from: 'inspection' },
    { key: 'gateType', label: 'Gate / Entry type', from: 'inspection' },
    { key: 'unauthorizedStructures', label: 'Unauthorized structures on land', from: 'inspection' },
  ],
  localityDescription: [
    { key: 'propertyNumber', label: 'Property No.', from: 'details' },
    { key: 'streetName', label: 'Street', from: 'details' },
    { key: 'villageTown', label: 'City / Village / Town', from: 'details' },
    { key: 'landTraditionalName', label: 'Land Traditional Name', from: 'details' },
    { key: 'district', label: 'District', from: 'details' },
    { key: 'province', label: 'Province', from: 'details' },
    { key: 'localAuthorityType', label: 'Local Authority Type', from: 'details' },
    { key: 'localAuthorityName', label: 'Local Authority Name', from: 'details' },
    { key: 'pattu', label: 'Pattu', from: 'details' },
    { key: 'korale', label: 'Korale', from: 'details' },
    { key: 'propertyType', label: 'Type of Property', from: 'details' },
  ],
  // Facilities/amenities of the area — from the inspection Locality Description.
  localityFacilities: [
    { key: 'villageTown', label: 'City / Village / Town', from: 'details' },
    { key: 'propertyType', label: 'Type of Property', from: 'details' },
    { key: 'vicinityCharacter', label: 'Character of immediate vicinity', from: 'inspection' },
    { key: 'nearbyFacilities', label: 'Nearby facilities / institutions', from: 'inspection' },
    { key: 'distanceFromNearestCity', label: 'Distance from nearest city', from: 'inspection' },
    { key: 'dayToDayNeeds', label: 'Availability of day-to-day needs', from: 'inspection' },
    { key: 'transportFrequency', label: 'Transport frequency', from: 'inspection' },
    { key: 'utilities', label: 'Utilities available (e.g. electricity, water, telephone)', from: 'inspection' },
  ],
  legalParagraph: [
    { key: 'deedType', label: 'Deed Type', from: 'details' },
    { key: 'deedNumber', label: 'Deed No.', from: 'details' },
    { key: 'deedDate', label: 'Deed Date', from: 'details' },
    { key: 'attorneyName', label: 'Attorney', from: 'details' },
    { key: 'notaryNoLocation', label: 'Notary', from: 'details' },
    { key: 'ownerNameAsPerDeed', label: 'Owner (per deed)', from: 'details' },
    { key: 'applicantName', label: 'Applicant Name', from: 'applicant' },
    { key: 'landRegistrySearchDone', label: 'Land Registry Search', from: 'details' },
    { key: 'previousOwnerName', label: 'Previous Owner', from: 'details' },
  ],
  localAuthorityTax: [
    { key: 'assessmentNumber', label: 'Assessment No.', from: 'details' },
    { key: 'assessmentLetterDate', label: 'Assessment Letter Date', from: 'details' },
    { key: 'assessmentAuthority', label: 'Authority Issuing Assessment', from: 'details' },
    { key: 'localAuthorityName', label: 'Local Authority Name', from: 'details' },
    { key: 'localAuthorityType', label: 'Local Authority Type', from: 'details' },
  ],
  streetLineBuildingLimits: [
    { key: 'streetLineCertDate', label: 'Street Line / Building Limit Certificate Date', from: 'details' },
    { key: 'affectedByStreetLines', label: 'Affected by Street Lines?', from: 'details' },
    { key: 'affectedByBuildingLimits', label: 'Affected by Building Limits?', from: 'details' },
    { key: 'distFromMainRoad', label: 'Distance from Main Road Centreline (ft)', from: 'details' },
    { key: 'distFromByRoad', label: 'Distance from By-Road Centreline (ft)', from: 'details' },
  ],
  mandatoryRequirements: [
    { key: 'localAuthorityName', label: 'Local Authority Name', from: 'details' },
    { key: 'localAuthorityType', label: 'Local Authority Type', from: 'details' },
    { key: 'planApprovalRef', label: 'Survey Plan Approval Ref. No.', from: 'details' },
    { key: 'planApprovalDate', label: 'Survey Plan Approval Date', from: 'details' },
    { key: 'planApprovalPurpose', label: 'Approval Purpose', from: 'details' },
    { key: 'cocProvided', label: 'Certificate of Conformity Provided?', from: 'details' },
    { key: 'planningAuthority', label: 'Planning Authority', from: 'details' },
    { key: 'propertyType', label: 'Character of Building', from: 'details' },
    { key: 'maxPlotCoverage', label: 'Max Plot Coverage % Allowed', from: 'details' },
    { key: 'plotCoverageProperty', label: 'Plot Coverage % of Subject Property', from: 'details' },
    { key: 'rentControlAffected', label: 'Rent Control Affected?', from: 'details' },
  ],
  conclusion: [
    { key: 'propertyType', label: 'Type of Property', from: 'details' },
    { key: 'marketTrend', label: 'Market trend (e.g. gradual increase / stable)', from: 'inspection' },
    { key: 'valuationMethod', label: 'Method of valuation (e.g. comparison / contractor\'s test)', from: 'inspection' },
    { key: 'perPerchRate', label: 'Adopted per perch rate', from: 'inspection' },
    { key: 'marketValue', label: 'Market Value (Rs.)', from: 'inspection' },
  ],
}

@Injectable()
export class DescriptionsService implements OnModuleInit {
  private readonly logger = new Logger(DescriptionsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.query(
        `CREATE TABLE IF NOT EXISTS descriptions (
           id SERIAL PRIMARY KEY,
           project_id VARCHAR(20) NOT NULL UNIQUE,
           data JSONB NOT NULL DEFAULT '{}',
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      )
    } catch (err) {
      this.logger.error(`Descriptions setup failed: ${(err as Error).message}`)
    }
  }

  // ---- gather ------------------------------------------------------------

  private async gather(projectId: string) {
    const pr = await this.db.query(`SELECT * FROM projects WHERE project_id = $1`, [projectId.trim()])
    const project = pr.rows[0] as Row
    if (!project) return null
    const nic = project.applicant_nic as string
    const appl = await this.db.query(
      `SELECT first_name, last_name, nic, email, phone FROM users WHERE nic = $1 AND role = 'Loan Applicant' LIMIT 1`,
      [nic],
    )
    const insp = await this.db.query(`SELECT data FROM inspections WHERE project_id = $1`, [projectId])
    const photos = await this.db.query(`SELECT photo_type, file_path FROM site_photos WHERE project_id = $1`, [projectId])
    // Bank/branch from the valuation (its details), not the deprecated table.
    const vd = ((await this.db.query(
      `SELECT details FROM valuations WHERE project_id = $1 ORDER BY valuation_id DESC LIMIT 1`, [projectId],
    )).rows[0]?.details ?? {}) as Row
    const bank = {
      rows: [{ bank_name: vd.bankName ?? '', branch_name: vd.branchName ?? '', officer_name: vd.bankContactPerson ?? '' }],
    }
    return {
      details: (project.details ?? {}) as Row,
      applicant: (appl.rows[0] ?? null) as Row | null,
      inspection: (insp.rows[0]?.data ?? {}) as Row,
      photos: photos.rows as { photo_type: string; file_path: string }[],
      bank: (bank.rows[0] ?? null) as Row | null,
    }
  }

  private val(g: NonNullable<Awaited<ReturnType<DescriptionsService['gather']>>>, f: Field): string {
    if (f.from === 'inspection') return String(g.inspection[f.key] ?? '')
    if (f.from === 'bank') return g.bank ? String(g.bank[f.key] ?? '') : ''
    if (f.from === 'applicant') {
      if (!g.applicant) return ''
      if (f.key === 'applicantName') return `${g.applicant.first_name} ${g.applicant.last_name}`.trim()
      return String(g.applicant[f.key] ?? '')
    }
    return String(g.details[f.key] ?? '')
  }

  // The editable sources per section + the list of site photos.
  async sources(projectId: string) {
    const g = await this.gather(projectId)
    if (!g) return null
    const sections = (Object.keys(SECTION_FIELDS) as TextSection[]).map((sec) => ({
      section: sec,
      label: LABELS[sec],
      fields: SECTION_FIELDS[sec].map((f) => ({ key: f.key, label: f.label, value: this.val(g, f) })),
    }))
    return { sources: sections, photos: g.photos.map((p) => p.photo_type) }
  }

  // ---- generation --------------------------------------------------------

  // Regenerate ONE section from the given (possibly edited) field values.
  async generateOne(projectId: string, section: string, fields: Record<string, string>) {
    if (section === 'imageAnalysis') {
      const g = await this.gather(projectId)
      if (!g) return { text: '', aiUsed: false }
      return this.generateImages(g.photos)
    }
    if (!(section in SECTION_FIELDS)) return { text: '', aiUsed: false }
    return this.generateText(section as TextSection, fields)
  }

  private async generateText(section: TextSection, fields: Record<string, string>) {
    if (this.ai.isEnabled()) {
      try {
        const hint =
          section === 'localityFacilities'
            ? ` Describe the character of the neighbourhood, the important institutions/facilities and their approximate distance, availability of day-to-day needs, the transport service, and (if provided) the available utilities/amenities such as electricity, water and telephone. Write it as a flowing professional paragraph.`
            : section === 'conclusion'
              ? ` Write a professional valuation conclusion: mention the market trend, that adopted rates considered adjustments and assumptions, that physical and economic attributes and prevailing market conditions were considered, the method of valuation, and end by stating the concluded current Market Value (format the value as "Rs. <amount> /-").`
              : section === 'mandatoryRequirements'
                ? ` Cover the survey plan approval (authority, reference, date, purpose), whether the Certificate of Conformity was provided, the planning authority, the maximum permissible plot coverage versus the subject property's plot coverage, that no other planning disputes were noted, and the rent control regulation (Rent Act No. 7 of 1972, Amendment Act No. 26 of 2002).`
                : ''
        const prompt =
          `You are a professional Sri Lankan land valuer writing a valuation report. ` +
          `Write the "${LABELS[section]}" paragraph using ONLY the facts below.${hint} ` +
          `Output ONLY the paragraph — no heading, no preamble, no markdown. Do not invent facts.\n\n` +
          `FACTS:\n${JSON.stringify(fields, null, 1)}`
        const text = (await this.ai.generate(prompt)).trim()
        if (text) return { text, aiUsed: true }
      } catch (err) {
        this.logger.error(`AI generation (${section}) failed: ${(err as Error).message}`)
      }
    }
    return { text: this.tpl(section, fields), aiUsed: false }
  }

  private async generateImages(photos: { photo_type: string; file_path: string }[]) {
    if (this.ai.isEnabled()) {
      try {
        const pick = photos.filter((p) => p.file_path).slice(0, 5)
        if (pick.length) {
          const images: { mediaType: string; base64: string }[] = []
          for (const p of pick) {
            const buf = await readFile(join(uploadDir, p.file_path))
            images.push({ mediaType: this.mime(p.file_path), base64: buf.toString('base64') })
          }
          const labels = pick.map((p, i) => `${i + 1}. ${p.photo_type}`).join('\n')
          const text = (
            await this.ai.generate(
              `These are site photographs for a land valuation, in this order:\n${labels}\n\n` +
                `For each, write one line: "<label>: <what it shows + any valuation-relevant observation>".`,
              images,
            )
          ).trim()
          if (text) return { text, aiUsed: true }
        }
      } catch (err) {
        this.logger.error(`AI image analysis failed: ${(err as Error).message}`)
      }
    }
    const text =
      photos.length === 0
        ? 'No site photographs uploaded.'
        : `AI image analysis unavailable (no API key). ${photos.length} photo(s): ${photos.map((p) => p.photo_type).join(', ')}.`
    return { text, aiUsed: false }
  }

  private mime(path: string): string {
    const e = extname(path).toLowerCase()
    if (e === '.png') return 'image/png'
    if (e === '.webp') return 'image/webp'
    if (e === '.gif') return 'image/gif'
    return 'image/jpeg'
  }

  // ---- templates (no AI key) ---------------------------------------------

  private tpl(section: TextSection, f: Record<string, string>): string {
    if (section === 'localityDescription') {
      const addr = [f.propertyNumber, f.streetName, f.villageTown].filter(Boolean).join(', ')
      const named = f.landTraditionalName ? `The land traditionally known as "${f.landTraditionalName}" ` : 'The property '
      const parts = [
        `${named}${f.propertyType ? `(a ${f.propertyType}) ` : ''}is situated at ${addr || '—'}, within the ${f.district || '—'} district of the ${f.province || '—'} province.`,
      ]
      if (f.localAuthorityName || f.localAuthorityType)
        parts.push(`The area is administered by the ${[f.localAuthorityName, f.localAuthorityType].filter(Boolean).join(' ')}.`)
      const legacy = [f.pattu && `${f.pattu} Pattu`, f.korale && `${f.korale} Korale`].filter(Boolean)
      if (legacy.length) parts.push(`(Traditional division: ${legacy.join(', ')}.)`)
      return parts.join(' ')
    }
    if (section === 'localityFacilities') {
      const parts = [`The property is situated in a ${f.propertyType || 'residential'} locality at ${f.villageTown || '—'}.`]
      if (f.vicinityCharacter) parts.push(`The immediate vicinity is ${f.vicinityCharacter}.`)
      if (f.nearbyFacilities)
        parts.push(
          `Important institutions such as ${f.nearbyFacilities} are located ${
            f.distanceFromNearestCity ? `within a radius of about ${f.distanceFromNearestCity}` : 'within the vicinity'
          } of the subject property.`,
        )
      if (f.dayToDayNeeds) parts.push(`Day-to-day needs ${f.dayToDayNeeds}.`)
      if (f.transportFrequency) parts.push(`${f.transportFrequency} transport service is operating in the area.`)
      if (f.utilities)
        parts.push(
          `The property is equipped with essential amenities including ${f.utilities}. These modern facilities are ` +
            `integrated into the region's infrastructure, enhancing the overall living experience.`,
        )
      return parts.join(' ')
    }
    if (section === 'mandatoryRequirements') {
      const authority = [f.localAuthorityName, f.localAuthorityType].filter(Boolean).join(' ') || 'the local authority'
      const parts: string[] = []
      if (f.planApprovalRef || f.planApprovalDate)
        parts.push(
          `The survey plan has been approved by the ${authority}${f.planApprovalRef ? ` under Ref. No. ${f.planApprovalRef}` : ''}` +
            `${f.planApprovalDate ? ` dated ${f.planApprovalDate}` : ''}${f.planApprovalPurpose ? ` for ${f.planApprovalPurpose.toLowerCase()} purpose` : ''}.`,
        )
      parts.push(`The Certificate of Conformity was ${f.cocProvided === 'Yes' ? 'provided' : 'not provided'}.`)
      if (f.planningAuthority) parts.push(`The Planning Authority is governed by the ${f.planningAuthority}.`)
      if (f.maxPlotCoverage || f.plotCoverageProperty)
        parts.push(
          `As per the ${f.planningAuthority || 'planning'} regulations, the maximum permissible plot coverage for a ` +
            `${(f.propertyType || 'residential').toLowerCase()} building is ${f.maxPlotCoverage || '—'}%, while the plot coverage ` +
            `of the subject property is ${f.plotCoverageProperty || '—'}%.`,
        )
      parts.push('No other planning regulation disputes were noted during the inspection.')
      parts.push(
        `Rent Control Regulation: this property is ${f.rentControlAffected === 'Yes' ? 'affected' : 'not affected'} by the ` +
          `Rent Act No. 7 of 1972 (Amendment Act No. 26 of 2002).`,
      )
      return parts.join(' ')
    }
    if (section === 'legalParagraph') {
      const owner = f.ownerNameAsPerDeed || f.applicantName || '—'
      let s = `The property is held under ${f.deedType || 'a deed'} No. ${f.deedNumber || '—'} dated ${f.deedDate || '—'}, in the name of ${owner}.`
      if (f.landRegistrySearchDone) s += ` A land registry search has been carried out (${f.landRegistrySearchDone}).`
      return s
    }
    if (section === 'localAuthorityTax') {
      const authority = [f.localAuthorityName, f.localAuthorityType].filter(Boolean).join(' ') || f.assessmentAuthority || 'the relevant local authority'
      let s = `The property is assessed for local authority rates and taxes under Assessment No. ${f.assessmentNumber || '—'}, issued by ${authority}.`
      if (f.assessmentLetterDate) s += ` The assessment is confirmed by the assessment letter dated ${f.assessmentLetterDate}.`
      if (f.assessmentAuthority && authority !== f.assessmentAuthority) s += ` The assessment was issued by ${f.assessmentAuthority}.`
      return s
    }
    if (section === 'streetLineBuildingLimits') {
      const sl = f.affectedByStreetLines === 'Yes' ? 'affected' : f.affectedByStreetLines === 'No' ? 'not affected' : 'reportedly'
      const bl = f.affectedByBuildingLimits === 'Yes' ? 'affected' : f.affectedByBuildingLimits === 'No' ? 'not affected' : 'reportedly'
      let s = `As per the street line and building limit certificate${f.streetLineCertDate ? ` dated ${f.streetLineCertDate}` : ''}, the property is ${sl} by street lines and ${bl} by building limits.`
      const dist: string[] = []
      if (f.distFromMainRoad) dist.push(`${f.distFromMainRoad} ft from the main road centreline`)
      if (f.distFromByRoad) dist.push(`${f.distFromByRoad} ft from the by-road centreline`)
      if (dist.length) s += ` The property lies approximately ${dist.join(' and ')}.`
      return s
    }
    if (section === 'conclusion') {
      const num = Number(String(f.marketValue).replace(/[^0-9.]/g, ''))
      const mv = f.marketValue
        ? Number.isFinite(num) && num > 0
          ? `Rs. ${num.toLocaleString('en-US')} /-`
          : `Rs. ${f.marketValue}`
        : 'Rs. —'
      const method = f.valuationMethod ? `${f.valuationMethod} method` : 'comparison method'
      return (
        `The real estate market around this property is experiencing ${f.marketTrend || 'steady activity'}. ` +
        `The adopted rates have been determined with careful consideration of adjustments and assumptions. ` +
        `During the assessment process, I thoroughly considered both the physical and economic attributes of the ` +
        `property, taking into account the prevailing market conditions in the local area. ` +
        `The property's valuation was conducted using the ${method} of valuation. ` +
        `Through an evaluation that accounts for various property characteristics, its location, and the method of ` +
        `valuation mentioned above, I hereby determine the current Market Value to be ${mv}.`
      )
    }
    // landDescription — built only from the inspection "Description of the Land".
    const parts: string[] = []
    if (f.landShape || f.landPosition)
      parts.push(`The land is ${f.landShape || 'of the recorded'} in shape${f.landPosition ? `, and lies ${f.landPosition} in relation to the road` : ''}.`)
    if (f.frontage) parts.push(`It has a frontage of approximately ${f.frontage} ft.`)
    if (f.boundariesMarked) parts.push(`The boundaries are ${f.boundariesMarked} on the ground.`)
    if (f.soilType) parts.push(`The soil is of a ${f.soilType} type.`)
    if (f.floodProne) parts.push(`Flood-prone status: ${f.floodProne}.`)
    if (f.drainage) parts.push(`Rainwater drainage is by ${f.drainage}.`)
    if (f.garbage) parts.push(`Garbage disposal is by ${f.garbage}.`)
    if (f.gateType) parts.push(`Entry is via a ${f.gateType}.`)
    if (f.unauthorizedStructures) parts.push(`Unauthorized structures on the land: ${f.unauthorizedStructures}.`)
    return parts.length ? parts.join(' ') : 'No land description details have been recorded in the inspection yet.'
  }

  // ---- valuation table (Contractor's Test Method) ------------------------

  // Computes the Section 11 valuation figures, pulling the adopted rate + land
  // value from the saved Analyse Nearby Lands analysis (fallback: inspection).
  async valuation(projectId: string) {
    const p = projectId.trim()
    const pr = await this.db.query(`SELECT details FROM projects WHERE project_id = $1`, [p])
    const details = (pr.rows[0]?.details ?? {}) as Row
    const acres = parseFloat(details.extentAcres) || 0
    const roods = parseFloat(details.extentRoods) || 0
    const perches = parseFloat(details.extentPerches) || 0
    const totalPerches = Math.round((acres * 160 + roods * 40 + perches) * 100) / 100
    const extentText = `${acres}A-${roods}R-${perches}P`

    const la = await this.db.query(`SELECT data FROM land_analyses WHERE project_id = $1`, [p])
    const na = (la.rows[0]?.data ?? null) as Row | null
    let rate = Number(na?.calculation?.ratePerPerch) || 0
    if (!rate) {
      const insp = await this.db.query(`SELECT data FROM inspections WHERE project_id = $1`, [p])
      rate = Number(String(insp.rows[0]?.data?.perPerchRate ?? '').replace(/[^0-9.]/g, '')) || 0
    }

    const landValue = Math.round(totalPerches * rate)
    const buildingValue = 0
    const marketValue = landValue + buildingValue
    // Round the adopted ("Say") value to the nearest Rs 100,000 — the customary
    // valuer rounding. Rounding to the nearest million would drop up to ~5% of
    // the value, which no valuer would do.
    const say = marketValue >= 100_000 ? Math.round(marketValue / 100_000) * 100_000 : marketValue
    // Strip a trailing "land" so a property type like "bare residential land"
    // doesn't read "…bare residential land land values…".
    const propertyType = String(details.propertyType || 'residential').toLowerCase().replace(/\s*land$/i, '')
    return {
      extentText,
      totalPerches,
      ratePerPerch: rate,
      landValue,
      buildingValue,
      marketValue,
      say,
      notes: [
        `Total Extent- ${extentText}`,
        `There is a demand for ${propertyType} land values in this locality, and this demand is anticipated to ` +
          `increase in the future as well. Based on the analyzed data in the immediate vicinity of the subject ` +
          `property, a value of Rs. ${rate.toLocaleString('en-US')}/- per perch is deemed fair and reasonable.`,
      ],
    }
  }

  // ---- evidence of land values (Section 9, from nearby analysis) ---------

  // Pulls the comparable evidence + value range from the saved Analyse Nearby
  // Lands analysis, for the RICS evidence-hierarchy section.
  async evidence(projectId: string) {
    const p = projectId.trim()
    const la = await this.db.query(`SELECT data FROM land_analyses WHERE project_id = $1`, [p])
    const na = (la.rows[0]?.data ?? null) as Row | null
    const comps = (na?.evidence?.comparables ?? []) as Row[]
    const prices = comps.map((c) => Number(c.pricePerPerch) || 0).filter((n) => n > 0)
    const rangeLow = na?.evidence?.rangeLow ?? (prices.length ? Math.min(...prices) : 0)
    const rangeHigh = na?.evidence?.rangeHigh ?? (prices.length ? Math.max(...prices) : 0)
    return {
      comparables: comps.map((c) => ({
        refNo: String(c.refNo ?? ''),
        date: String(c.saleDate ?? ''),
        extentPerches: Number(c.extentPerches) || 0,
        distanceKm: Number(c.distanceKm) || 0,
        pricePerPerch: Number(c.pricePerPerch) || 0,
        evidenceType: String(c.evidenceType ?? 'Recent Land Sale'),
        source: String(c.source ?? ''),
      })),
      rangeLow,
      rangeHigh,
      hasAnalysis: !!na,
    }
  }

  // ---- persistence -------------------------------------------------------

  async get(projectId: string) {
    const r = await this.db.query(`SELECT data FROM descriptions WHERE project_id = $1`, [projectId.trim()])
    return (r.rows[0]?.data as Record<string, string>) ?? null
  }

  // Projects that have already been saved (so they drop off the "to do" list).
  async completedProjects(): Promise<string[]> {
    const r = await this.db.query(`SELECT project_id FROM descriptions`)
    return r.rows.map((x) => x.project_id as string)
  }

  async save(projectId: string, data: Record<string, string>) {
    const p = (projectId ?? '').trim()
    if (!p) return { ok: false, error: 'Missing project.' }
    await this.db.query(
      `INSERT INTO descriptions (project_id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (project_id) DO UPDATE SET data = EXCLUDED.data, created_at = now()`,
      [p, JSON.stringify(data ?? {})],
    )
    return { ok: true }
  }
}
