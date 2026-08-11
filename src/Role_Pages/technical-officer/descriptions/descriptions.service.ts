import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { AiService } from '../../../Common_Pages/ai/ai.service'
import { ObjectStorageService } from '../../../Common_Pages/storage/object-storage.service'

type Row = Record<string, any>

// Which data source each field is read from.
type Field = { key: string; label: string; from: 'details' | 'inspection' | 'applicant' | 'bank' | 'valuation' }
type TextSection =
  | 'requestDescription'
  | 'limitations'
  | 'generalAssumptions'
  | 'situation'
  | 'extentDescription'
  | 'accessDescription'
  | 'ownershipDescription'
  | 'rentControlRegulation'
  | 'certification'
  | 'landDescription'
  | 'localityDescription'
  | 'localityFacilities'
  | 'legalParagraph'
  | 'localAuthorityTax'
  | 'streetLineBuildingLimits'
  | 'mandatoryRequirements'
  | 'conclusion'

const LABELS: Record<TextSection | 'imageAnalysis', string> = {
  requestDescription: 'Request Description',
  limitations: 'Limitations',
  generalAssumptions: 'General Assumptions',
  situation: 'Situation',
  extentDescription: 'Extent / Survey & Deed Particulars',
  accessDescription: 'Access and Nature of the Accessibility',
  ownershipDescription: 'Ownership',
  rentControlRegulation: 'Rent Control Regulation',
  certification: 'Certification',
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
    { key: 'streetName', label: 'Street / Road Name', from: 'details' },
    { key: 'localityName', label: 'Village, town or locality', from: 'inspection' },
    { key: 'nearestTown', label: 'Nearest main town', from: 'inspection' },
    { key: 'distanceToNearestTown', label: 'Distance to nearest town', from: 'inspection' },
    { key: 'vicinityCharacter', label: 'Character of locality', from: 'inspection' },
    { key: 'surroundingPropertyTypes', label: 'Surrounding property types', from: 'inspection' },
    { key: 'developmentLevel', label: 'Development level', from: 'inspection' },
    { key: 'marketDemand', label: 'Market demand', from: 'inspection' },
    { key: 'highDemandPropertyTypes', label: 'High-demand property types', from: 'inspection' },
    { key: 'demandReason', label: 'Reasons for demand', from: 'inspection' },
    { key: 'availableUtilities', label: 'Available utilities', from: 'inspection' },
    { key: 'nearbyFacilities', label: 'Nearby facilities', from: 'inspection' },
    { key: 'facilitiesRadius', label: 'Facilities radius', from: 'inspection' },
    { key: 'transportFrequency', label: 'Transport frequency', from: 'inspection' },
    { key: 'transportRoad', label: 'Public transport road', from: 'inspection' },
    { key: 'distanceToTransport', label: 'Distance to transport', from: 'inspection' },
    { key: 'dayToDayNeeds', label: 'Daily necessities available nearby?', from: 'inspection' },
    { key: 'dayToDayNeedsLocation', label: 'Daily necessities location', from: 'inspection' },
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
    { key: 'localAuthorityName', label: 'Local Authority Name', from: 'details' },
  ],
  streetLineBuildingLimits: [
    { key: 'localAuthorityName', label: 'Local Authority Name', from: 'details' },
    { key: 'assessmentLetterDate', label: 'Assessment Letter Date', from: 'details' },
    { key: 'assessmentAuthority', label: 'Authority Issuing Assessment', from: 'details' },
    { key: 'streetLineCertDate', label: 'Street Line / Building Limit Certificate Date', from: 'details' },
    { key: 'affectedByStreetLines', label: 'Affected by Street Lines?', from: 'details' },
    { key: 'affectedByBuildingLimits', label: 'Affected by Building Limits?', from: 'details' },
    { key: 'distFromMainRoad', label: 'Distance from Main Road Centreline (ft)', from: 'details' },
    { key: 'distFromByRoad', label: 'Distance from By-Road Centreline (ft)', from: 'details' },
  ],
  mandatoryRequirements: [
    { key: 'localAuthorityName', label: 'Local Authority Name', from: 'details' },
    { key: 'assessmentNumber', label: 'Assessment Number', from: 'details' },
    { key: 'planApprovedByLA', label: 'Survey Plan Approved by Local Authority?', from: 'details' },
    { key: 'planApprovalRef', label: 'Survey Plan Approval Ref. No.', from: 'details' },
    { key: 'planApprovalDate', label: 'Survey Plan Approval Date', from: 'details' },
    { key: 'planApprovalPurpose', label: 'Approval Purpose', from: 'details' },
  ],
  conclusion: [
    { key: 'propertyType', label: 'Type of Property', from: 'details' },
    { key: 'marketTrend', label: 'Market trend (e.g. gradual increase / stable)', from: 'inspection' },
    { key: 'valuationMethod', label: 'Method of valuation (e.g. comparison / contractor\'s test)', from: 'inspection' },
    { key: 'perPerchRate', label: 'Adopted per perch rate', from: 'inspection' },
    { key: 'marketValue', label: 'Market Value (Rs.)', from: 'inspection' },
  ],
  requestDescription: [
    { key: 'bankName', label: 'Bank', from: 'valuation' }, { key: 'branchName', label: 'Branch', from: 'valuation' }, { key: 'bankRequestDate', label: "Date of Bank's Request Letter", from: 'valuation' }, { key: 'valuationPurpose', label: 'Purpose of Valuation', from: 'valuation' },
    { key: 'lotNumber', label: 'Lot Number', from: 'details' }, { key: 'surveyPlanNumber', label: 'Survey Plan Number', from: 'details' }, { key: 'surveyPlanDate', label: 'Survey Plan Date', from: 'details' }, { key: 'surveyorName', label: 'Licensed Surveyor Name', from: 'details' }, { key: 'villageTown', label: 'Village / Town', from: 'details' }, { key: 'localAuthorityName', label: 'Local Authority Name', from: 'details' },
  ],
  limitations: [{ key: 'bankName', label: 'Bank', from: 'valuation' }, { key: 'valuationPurpose', label: 'Purpose of Valuation', from: 'valuation' }],
  generalAssumptions: [{ key: 'ownershipType', label: 'Ownership Type', from: 'details' }],
  situation: [
    { key: 'landTraditionalName', label: 'Land Traditional Name', from: 'details' }, { key: 'localAuthorityType', label: 'Local Authority Type', from: 'details' }, { key: 'localAuthorityName', label: 'Local Authority Name', from: 'details' }, { key: 'pattu', label: 'Pattu', from: 'details' }, { key: 'korale', label: 'Korale', from: 'details' }, { key: 'district', label: 'District', from: 'details' }, { key: 'province', label: 'Province', from: 'details' }, { key: 'villageTown', label: 'Village / Town', from: 'details' }, { key: 'gnDivision', label: 'GN Division', from: 'details' }, { key: 'dsDivision', label: 'DS Division', from: 'details' }, { key: 'postalCode', label: 'Postal Code', from: 'details' },
  ],
  extentDescription: [
    { key: 'lotNumber', label: 'Lot Number', from: 'details' }, { key: 'surveyPlanNumber', label: 'Survey Plan Number', from: 'details' }, { key: 'surveyPlanDate', label: 'Survey Plan Date', from: 'details' }, { key: 'surveyorName', label: 'Licensed Surveyor Name', from: 'details' }, { key: 'surveyorLicenseNo', label: 'Surveyor License Number', from: 'details' }, { key: 'deedType', label: 'Deed Type', from: 'details' }, { key: 'deedNumber', label: 'Deed Number', from: 'details' }, { key: 'deedDate', label: 'Deed Date', from: 'details' }, { key: 'attorneyName', label: 'Attorney at Law Name', from: 'details' }, { key: 'notaryNoLocation', label: 'Notary Public Number / Location', from: 'details' },
    { key: 'extentAsPerPlan', label: 'Extent as per Survey Plan', from: 'details' }, { key: 'extentAsPerDeed', label: 'Extent as per Deed', from: 'details' }, { key: 'extentsTally', label: 'Plan and Deed Extents Tally?', from: 'details' },
  ],
  accessDescription: [
    { key: 'accessRoute', label: 'Access route description from nearest town', from: 'inspection' }, { key: 'roadWidth', label: 'Access road width', from: 'inspection' }, { key: 'roadType', label: 'Road type', from: 'inspection' }, { key: 'roadFacing', label: 'Road facing direction / Boundary facing road', from: 'inspection' }, { key: 'distanceFromNearestCity', label: 'Distance from nearest city', from: 'inspection' }, { key: 'rightOfWay', label: 'Right of way confirmation', from: 'inspection' }, { key: 'villageTown', label: 'Village / Town', from: 'details' }, { key: 'streetName', label: 'Street / Road Name', from: 'details' },
  ],
  ownershipDescription: [
    { key: 'deedType', label: 'Deed Type', from: 'details' }, { key: 'deedNumber', label: 'Deed Number', from: 'details' }, { key: 'deedDate', label: 'Deed Date', from: 'details' }, { key: 'attorneyName', label: 'Attorney at Law Name', from: 'details' }, { key: 'notaryNoLocation', label: 'Notary Public Number / Location', from: 'details' }, { key: 'ownerNameAsPerDeed', label: 'Owner Name as per Deed', from: 'details' },
  ],
  rentControlRegulation: [{ key: 'rentControlAffected', label: 'Rent Control Affected?', from: 'details' }],
  certification: [{ key: 'lotNumber', label: 'Lot Number', from: 'details' }, { key: 'surveyPlanNumber', label: 'Survey Plan Number', from: 'details' }, { key: 'surveyPlanDate', label: 'Survey Plan Date', from: 'details' }, { key: 'surveyorName', label: 'Licensed Surveyor Name', from: 'details' }, { key: 'boundariesMatch', label: 'Physical Boundaries Match Survey Plan?', from: 'inspection' }],
}

@Injectable()
export class DescriptionsService implements OnModuleInit {
  private readonly logger = new Logger(DescriptionsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly storage: ObjectStorageService,
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
    const photos = await this.db.query(`SELECT photo_type, file_mime, object_key FROM site_photos WHERE project_id = $1`, [projectId])
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
      photos: photos.rows as { photo_type: string; file_mime: string; object_key: string }[],
      bank: (bank.rows[0] ?? null) as Row | null,
      valuation: vd,
    }
  }

  private val(g: NonNullable<Awaited<ReturnType<DescriptionsService['gather']>>>, f: Field): string {
    if (f.from === 'inspection') return String(g.inspection[f.key] ?? '')
    if (f.from === 'valuation') return String(g.valuation[f.key] ?? '')
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
    const reportText = this.reportStyleTemplate(section, fields)
    if (reportText !== null) return { text: reportText, aiUsed: false }

    if (this.ai.isEnabled()) {
      try {
        const hint =
          section === 'localityFacilities'
            ? ` Describe the character of the neighbourhood, the important institutions/facilities and their approximate distance, availability of day-to-day needs, the transport service, and (if provided) the available utilities/amenities such as electricity, water and telephone. Write it as a flowing professional paragraph.`
            : section === 'conclusion'
              ? ` Write a professional valuation conclusion: mention the market trend, that adopted rates considered adjustments and assumptions, that physical and economic attributes and prevailing market conditions were considered, the method of valuation, and end by stating the concluded current Market Value (format the value as "Rs. <amount> /-").`
              : section === 'mandatoryRequirements'
                ? ` Cover only the local authority, assessment number, survey-plan approval status, approval reference, approval date and approval purpose supplied in the facts.`
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

  private async generateImages(photos: { photo_type: string; file_mime: string; object_key: string }[]) {
    if (this.ai.isEnabled()) {
      try {
        const pick = photos.filter((p) => p.object_key).slice(0, 5)
        if (pick.length) {
          const images: { mediaType: string; base64: string }[] = []
          for (const p of pick) {
            const buf = await this.storage.read(p.object_key)
            if (buf) images.push({ mediaType: p.file_mime || 'image/jpeg', base64: buf.toString('base64') })
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

  // ---- templates (no AI key) ---------------------------------------------

  private reportStyleTemplate(section: TextSection, f: Record<string, string>): string | null {
    const value = (key: string, fallback = '') => String(f[key] ?? '').trim() || fallback
    const rawPurpose = value('valuationPurpose', 'the stated purpose').replace(/^for\s+/i, '').replace(/\s+purpose$/i, '')
    const cleanPurpose = /^loan$/i.test(rawPurpose) ? 'secured lending purposes' : rawPurpose
    const authority = [value('localAuthorityName'), value('localAuthorityType')].filter(Boolean).join(' ')
    const ref = (kind: string, number: string, date: string) =>
      `${kind}${number ? ` No. ${number}` : ''}${date ? ` dated ${date}` : ''}`
    const yes = (input: string) => /^(yes|confirmed|available|true)$/i.test(input.trim())
    const no = (input: string) => /^(no|not confirmed|not available|false)$/i.test(input.trim())

    if (section === 'requestDescription') {
      const bank = value('bankName', 'The instructing bank')
      const branch = value('branchName')
      const plan = ref('Survey Plan', value('surveyPlanNumber'), value('surveyPlanDate'))
      return `${bank}${branch ? ` - ${branch} Branch` : ''} has requested, by its letter${value('bankRequestDate') ? ` dated ${value('bankRequestDate')}` : ''}, an inspection and valuation of the property depicted as Lot No. ${value('lotNumber', 'not stated')} in ${plan}, prepared by ${value('surveyorName', 'the Licensed Surveyor')}, situated at ${value('villageTown', 'the stated locality')}${value('localAuthorityName') ? ` within the administrative limits of ${value('localAuthorityName')}` : ''}, in order to estimate the market value and forced sale value for ${cleanPurpose}.`
    }

    if (section === 'limitations') {
      const bank = value('bankName', 'the instructing institution')
      return [
        `- This valuation is valid only for the estimation of market value and forced sale value for ${cleanPurpose} and shall not be used for any other purpose or in any manner other than as stated herein.`,
        `- No liability is accepted for any loss or damage arising from the use of this report for a purpose other than its intended purpose.`,
        `- This valuation has been prepared solely for ${bank}. No responsibility is accepted to any third party for the whole or any part of its contents.`,
        `- The valuation relies on the documents, information and conditions available at the date of inspection. No responsibility is accepted for matters that were not reasonably observable or disclosed at that date.`,
        `- The legal and survey particulars are based on documents supplied by the client. The valuer accepts no responsibility for errors or omissions attributable to other professionals, including surveyors, architects and legal advisers.`,
        `- No responsibility is accepted for concealed or non-visible conditions at the property, or for alterations made after the date of valuation.`,
        `- Neither the whole nor any part of this report may be published or reproduced without the prior written approval of the undersigned as to its form and context.`,
        `- The analysis, opinions and conclusions are subject to the assumptions and limiting conditions stated in this report.`,
      ].join('\n')
    }

    if (section === 'generalAssumptions') {
      const interest = value('ownershipType', 'freehold')
      return [
        `- The property has been valued on the assumption that the owner holds a valid and unencumbered ${interest.toLowerCase()} interest in the property.`,
        `- The property has been valued as if wholly owned, without allowance for undisclosed debts, mortgage bonds, loans, charges, easements, disputes or other encumbrances, except where expressly stated in this report.`,
      ].join('\n')
    }

    if (section === 'situation') {
      const divisions = [
        value('gnDivision') && `${value('gnDivision')} Grama Niladhari Division`,
        value('dsDivision') && `${value('dsDivision')} Divisional Secretariat Division`,
        value('pattu') && `${value('pattu')} Pattu`,
        value('korale') && `${value('korale')} Korale`,
      ].filter(Boolean).join(', ')
      return `The land${value('landTraditionalName') ? ` called "${value('landTraditionalName')}"` : ''} is situated at ${value('villageTown', 'the stated locality')}${value('postalCode') ? `, Postal Code ${value('postalCode')}` : ''}${authority ? ` within the administrative limits of ${authority}` : ''}${divisions ? `, in ${divisions}` : ''}${value('district') ? `, District of ${value('district')}` : ''}${value('province') ? `, ${value('province')} Province` : ''}.`
    }

    if (section === 'extentDescription') {
      const plan = ref('Survey Plan', value('surveyPlanNumber'), value('surveyPlanDate'))
      const deed = ref(value('deedType', 'Deed'), value('deedNumber'), value('deedDate'))
      const surveyor = value('surveyorName', 'the Licensed Surveyor')
      const attestor = value('attorneyName') || value('notaryNoLocation') || 'the stated Notary Public'
      const sentences = [
        `The subject property is depicted as Lot No. ${value('lotNumber', 'not stated')} in ${plan}, prepared by ${surveyor}${value('surveyorLicenseNo') ? `, Licensed Surveyor No. ${value('surveyorLicenseNo')}` : ''}.`,
        `The title particulars refer to ${deed}, attested by ${attestor}${value('notaryNoLocation') && value('attorneyName') ? `, ${value('notaryNoLocation')}` : ''}.`,
      ]
      if (value('extentAsPerPlan')) sentences.push(`The extent shown in the survey plan is ${value('extentAsPerPlan')}.`)
      if (value('extentAsPerDeed')) sentences.push(`The extent stated in the deed is ${value('extentAsPerDeed')}.`)
      if (value('extentsTally')) sentences.push(`The extents stated in the survey plan and deed ${yes(value('extentsTally')) ? 'tally with each other' : no(value('extentsTally')) ? 'do not tally and require further verification' : `are recorded as ${value('extentsTally')}`}.`)
      return sentences.join(' ')
    }

    if (section === 'accessDescription') {
      const sentences: string[] = []
      if (value('accessRoute')) sentences.push(value('accessRoute').replace(/[.\s]+$/, '') + '.')
      else sentences.push(`The property is accessible from ${value('villageTown', 'the nearest town')} by the recorded public road network.`)
      const roadType = value('roadType').replace(/\s+road$/i, '')
      const road = [value('roadWidth') && `${value('roadWidth')} wide`, roadType].filter(Boolean).join(' ')
      if (road) sentences.push(`The access road is a ${road} road.`)
      if (/\b(north|south|east|west)(ern)?\b/i.test(value('roadFacing'))) sentences.push(`The property faces the access road along its ${value('roadFacing').replace(/\.$/, '')} boundary.`)
      if (value('distanceFromNearestCity')) sentences.push(`The property is approximately ${value('distanceFromNearestCity')} from the nearest main town.`)
      if (value('rightOfWay')) sentences.push(`Legal right of way is ${yes(value('rightOfWay')) || /legal/i.test(value('rightOfWay')) ? 'available from the public road' : value('rightOfWay').replace(/\.$/, '')}.`)
      return sentences.join(' ')
    }

    if (section === 'landDescription') {
      const sentences: string[] = []
      if (value('landShape') || value('landPosition')) {
        const position = value('landPosition').replace(/[.]+$/, '').toLowerCase()
        sentences.push(`The land is ${value('landShape', 'of regular form').toLowerCase()} in shape${position ? ` and ${/^adjoins?\b/.test(position) ? position : `is positioned ${position}`}` : ''}.`)
      }
      if (value('frontage')) sentences.push(`The property has a frontage of ${value('frontage').replace(/^approx(?:imately)?\.?\s*/i, 'approximately ').replace(/[.]+$/, '')} along the access road.`)
      if (value('floodProne')) sentences.push(yes(value('floodProne')) ? 'The property is reported to be prone to flooding.' : no(value('floodProne')) || /^not/i.test(value('floodProne')) ? 'The subject property is not reported to be prone to flooding.' : `Flood susceptibility is recorded as ${value('floodProne').toLowerCase()}.`)
      if (value('boundariesMarked')) sentences.push(yes(value('boundariesMarked')) || /^yes/i.test(value('boundariesMarked')) ? 'The boundaries are clearly marked on the ground.' : `The boundaries on the ground are recorded as ${value('boundariesMarked').toLowerCase()}.`)
      if (value('soilType')) sentences.push(`The soil is predominantly ${value('soilType').toLowerCase()} and should be considered together with any specialist geotechnical advice required for development.`)
      if (value('drainage')) sentences.push(`Rainwater drainage is provided by ${value('drainage').replace(/[.]+$/, '').toLowerCase()}.`)
      if (value('garbage')) sentences.push(`Garbage disposal is managed by ${value('garbage').replace(/[.]+$/, '')}.`)
      if (value('gateType')) sentences.push(`Access to the land is provided through a ${value('gateType').replace(/^(a|an)\s+/i, '').toLowerCase()}.`)
      if (value('unauthorizedStructures')) sentences.push(no(value('unauthorizedStructures')) || /^none/i.test(value('unauthorizedStructures')) ? 'No unauthorized structures were reported on the land.' : `The following unauthorized structure condition was reported: ${value('unauthorizedStructures').replace(/[.]+$/, '')}.`)
      return sentences.join(' ') || 'No sufficient site inspection details have been recorded to prepare the land description.'
    }

    if (section === 'ownershipDescription') {
      const deed = ref(value('deedType', 'Deed'), value('deedNumber'), value('deedDate'))
      const attestor = value('attorneyName') || value('notaryNoLocation') || 'the stated Notary Public'
      return `From the documents made available, ${value('ownerNameAsPerDeed', 'the person named in the deed')} claims ownership of the subject property under ${deed}, attested by ${attestor}${value('notaryNoLocation') && value('attorneyName') ? `, ${value('notaryNoLocation')}` : ''}. This valuation is based on the title particulars supplied and does not constitute a legal opinion on title.`
    }

    if (section === 'localAuthorityTax') {
      return `The premises have been assessed by ${value('localAuthorityName', 'the relevant local authority')} for the levy of local authority rates and taxes under Assessment No. ${value('assessmentNumber', 'not stated')}${value('assessmentLetterDate') ? `, as evidenced by the assessment letter dated ${value('assessmentLetterDate')}` : ''}.`
    }

    if (section === 'streetLineBuildingLimits') {
      const street = yes(value('affectedByStreetLines')) ? 'affected by street lines' : no(value('affectedByStreetLines')) ? 'not affected by street lines' : 'not confirmed with regard to street lines'
      const building = yes(value('affectedByBuildingLimits')) ? 'affected by building limits' : no(value('affectedByBuildingLimits')) ? 'not affected by building limits' : 'not confirmed with regard to building limits'
      return `According to the Street Line and Building Limit Certificate${value('streetLineCertDate') ? ` dated ${value('streetLineCertDate')}` : ''} issued by ${value('assessmentAuthority') || value('localAuthorityName') || 'the relevant local authority'}, the property is ${street} and is ${building}${value('distFromMainRoad') ? `, with the applicable limit being ${value('distFromMainRoad')} feet from the centreline of the main road` : ''}${value('distFromByRoad') ? ` and ${value('distFromByRoad')} feet from the centreline of the by-road` : ''}.`
    }

    if (section === 'mandatoryRequirements') {
      const status = yes(value('planApprovedByLA')) ? 'has been approved' : no(value('planApprovedByLA')) ? 'has not been approved' : 'has not been confirmed as approved'
      return `The survey plan ${status} by ${value('localAuthorityName', 'the relevant local authority')}${value('planApprovalRef') ? ` under Reference No. ${value('planApprovalRef')}` : ''}${value('planApprovalDate') ? ` dated ${value('planApprovalDate')}` : ''}${value('planApprovalPurpose') ? ` for ${value('planApprovalPurpose').replace(/\s+purpose$/i, '').toLowerCase()} purpose` : ''}. The approval particulars should be verified against the original document before the report is finalized.`
    }

    if (section === 'rentControlRegulation') {
      const status = value('rentControlAffected')
      return yes(status)
        ? 'The subject property is reported to be affected by the applicable rent control legislation.'
        : no(status)
          ? 'The subject property is reported not to be affected by the Rent Act No. 7 of 1972, as amended.'
          : 'The application of rent control legislation to the subject property has not been confirmed from the documents supplied.'
    }

    if (section === 'localityDescription') {
      const locality = value('localityName') || value('streetName') || 'the stated locality'
      const sentences = [`The property is situated in ${value('vicinityCharacter') ? `a ${value('vicinityCharacter').toLowerCase()} locality` : 'the locality'} at ${locality}.`]
      if (value('developmentLevel') || value('surroundingPropertyTypes')) sentences.push(`The immediate vicinity is ${value('developmentLevel', 'developed').toLowerCase()} and is predominantly characterized by ${value('surroundingPropertyTypes', 'the developments observed during the inspection').toLowerCase()}.`)
      if (value('marketDemand')) sentences.push(`There is ${value('marketDemand').toLowerCase()} demand for ${value('highDemandPropertyTypes', 'property in this locality').toLowerCase()}${value('demandReason') ? `, principally due to ${value('demandReason').replace(/[.]+$/, '').toLowerCase()}` : ''}.`)
      if (value('nearestTown')) sentences.push(`The nearest main town is ${value('nearestTown')}${value('distanceToNearestTown') ? `, approximately ${value('distanceToNearestTown')} from the property` : ''}.`)
      if (value('availableUtilities')) sentences.push(`Utility services including ${value('availableUtilities')} are available in the area.`)
      if (value('nearbyFacilities')) {
        if (/^situated\b/i.test(value('nearbyFacilities'))) sentences.push(value('nearbyFacilities').replace(/[.]+$/, '') + '.')
        else sentences.push(`Important institutions and facilities, including ${value('nearbyFacilities').replace(/[.]+$/, '')}, are available${value('facilitiesRadius') ? ` within an approximate radius of ${value('facilitiesRadius')}` : ' in the vicinity'}.`)
      }
      if (value('dayToDayNeeds')) sentences.push(yes(value('dayToDayNeeds')) ? `Day-to-day requirements can be obtained from ${value('dayToDayNeedsLocation', 'the same locality').toLowerCase()}.` : `Day-to-day requirements are ${value('dayToDayNeeds').toLowerCase()}${value('dayToDayNeedsLocation') ? ` at ${value('dayToDayNeedsLocation').toLowerCase()}` : ''}.`)
      if (value('transportFrequency')) {
        const transportDistance = value('distanceToTransport')
        const distancePhrase = transportDistance
          ? /direct|adjacent|frontage/i.test(transportDistance)
            ? `; ${transportDistance.replace(/[.]+$/, '').toLowerCase()}`
            : `, with the nearest transport point approximately ${transportDistance} from the property`
          : ''
        sentences.push(`${value('transportFrequency')} public transport services operate${value('transportRoad') ? ` along ${value('transportRoad')}` : ' in the area'}${distancePhrase}.`)
      }
      return sentences.join(' ')
    }

    if (section === 'certification') {
      const plan = ref('Survey Plan', value('surveyPlanNumber'), value('surveyPlanDate'))
      const match = value('boundariesMatch')
      return `I certify that the property inspected and valued corresponds to Lot No. ${value('lotNumber', 'not stated')} in ${plan}, prepared by ${value('surveyorName', 'the Licensed Surveyor')}.${match ? ` The boundaries observed at the site ${yes(match) ? 'correspond with those shown in the survey plan' : no(match) ? 'do not fully correspond with those shown in the survey plan and require clarification' : `are recorded as follows: ${match}`}.` : ''} Subject to the assumptions and limiting conditions stated in this report, the opinion of value has been formed from the documents supplied, the site inspection and the available market evidence.`
    }

    return null
  }

  private tpl(section: TextSection, f: Record<string, string>): string {
    if (section === 'requestDescription')
      return `The ${f.bankName || 'requesting bank'}${f.branchName ? `, ${f.branchName} Branch,` : ''} has requested, by its letter dated ${f.bankRequestDate || 'the stated date'}, an inspection and valuation of the property depicted as Lot No. ${f.lotNumber || '—'} in Survey Plan No. ${f.surveyPlanNumber || '—'} dated ${f.surveyPlanDate || '—'}, prepared by ${f.surveyorName || 'the licensed surveyor'}, situated at ${f.villageTown || '—'} within the administrative limits of ${f.localAuthorityName || 'the relevant local authority'}, for the purpose of ${f.valuationPurpose || 'the stated valuation purpose'}.`
    if (section === 'limitations')
      return `This valuation is prepared solely for ${f.valuationPurpose || 'the stated purpose'} at the request of ${f.bankName || 'the instructing bank'} and must not be used for any other purpose. The conclusions are based on the documents and information supplied, the conditions observable at the date of inspection, and the assumptions stated in the report; no responsibility is accepted for concealed defects, subsequent changes, or reliance by unauthorised third parties.`
    if (section === 'generalAssumptions')
      return `The property has been valued on the assumption that the owner holds a valid ${f.ownershipType || 'lawful'} interest in the property, free from undisclosed encumbrances, restrictions, disputes, debts, mortgages or other charges, except where expressly stated in this report.`
    if (section === 'situation') {
      const divisions = [f.gnDivision && `${f.gnDivision} GN Division`, f.dsDivision && `${f.dsDivision} Divisional Secretariat Division`, f.pattu && `${f.pattu} Pattu`, f.korale && `${f.korale} Korale`].filter(Boolean).join(', ')
      return `The land traditionally known as ${f.landTraditionalName || 'the subject property'} is situated at ${f.villageTown || '—'}${f.postalCode ? `, Postal Code ${f.postalCode}` : ''}, in the ${f.district || '—'} District of the ${f.province || '—'} Province. It falls within the jurisdiction of the ${[f.localAuthorityName, f.localAuthorityType].filter(Boolean).join(' ') || 'relevant local authority'}${divisions ? ` and within ${divisions}` : ''}.`
    }
    if (section === 'extentDescription')
      return `The subject property is depicted as Lot No. ${f.lotNumber || '—'} in Survey Plan No. ${f.surveyPlanNumber || '—'} dated ${f.surveyPlanDate || '—'}, prepared by ${f.surveyorName || '—'}${f.surveyorLicenseNo ? `, Licensed Surveyor No. ${f.surveyorLicenseNo}` : ''}. Title particulars were considered with reference to ${f.deedType || 'the deed'} No. ${f.deedNumber || '—'} dated ${f.deedDate || '—'}, attested by ${f.attorneyName || f.notaryNoLocation || 'the stated notary public'}${f.notaryNoLocation ? ` (${f.notaryNoLocation})` : ''}.`
    if (section === 'accessDescription')
      return `The subject property at ${[f.streetName, f.villageTown].filter(Boolean).join(', ') || 'the stated location'} is approached ${f.accessRoute || 'by the recorded access route from the nearest town'}. The access road is approximately ${f.roadWidth || '—'} wide and is ${f.roadType || 'of the recorded construction'}, with the property facing the road along its ${f.roadFacing || 'stated boundary'}. The property is approximately ${f.distanceFromNearestCity || '—'} from the nearest city. Right of way is ${f.rightOfWay || 'to be confirmed from the title documents'}.`
    if (section === 'ownershipDescription')
      return `According to the documents produced, title to the property is held by ${f.ownerNameAsPerDeed || '—'} under ${f.deedType || 'the deed'} No. ${f.deedNumber || '—'} dated ${f.deedDate || '—'}, attested by ${f.attorneyName || 'the stated attorney/notary'}${f.notaryNoLocation ? ` under reference/location ${f.notaryNoLocation}` : ''}.`
    if (section === 'rentControlRegulation')
      return `Based on the information provided, the subject property is ${f.rentControlAffected === 'Yes' ? 'affected' : f.rentControlAffected === 'No' ? 'not affected' : 'not confirmed as affected'} by the applicable rent control legislation.`
    if (section === 'certification')
      return `I certify that the property inspected and valued corresponds to Lot No. ${f.lotNumber || '—'} in Survey Plan No. ${f.surveyPlanNumber || '—'} dated ${f.surveyPlanDate || '—'}, prepared by ${f.surveyorName || 'the licensed surveyor'}, and that the conclusions stated in this report have been formed from the information made available and the observations recorded during the inspection.`
    if (section === 'localityDescription') {
      const parts = [`The property is situated in a ${(f.vicinityCharacter || 'developed').toLowerCase()} locality at ${f.localityName || f.streetName || 'the stated location'}.`]
      if (f.surroundingPropertyTypes || f.developmentLevel) parts.push(`The immediate vicinity is ${(f.developmentLevel || 'developed').toLowerCase()} and is predominantly characterised by ${f.surroundingPropertyTypes || 'the recorded surrounding developments'}.`)
      if (f.marketDemand) parts.push(`There is ${f.marketDemand.toLowerCase()} demand for ${f.highDemandPropertyTypes || 'properties in this locality'}${f.demandReason ? ` due to ${f.demandReason}` : ''}.`)
      if (f.availableUtilities) parts.push(`Utility services including ${f.availableUtilities} are available.`)
      if (f.nearbyFacilities) parts.push(`Important facilities such as ${f.nearbyFacilities} are available${f.facilitiesRadius ? ` within approximately ${f.facilitiesRadius}` : ' in the vicinity'}.`)
      if (f.dayToDayNeeds) parts.push(`Day-to-day necessities ${f.dayToDayNeeds === 'Yes' ? `can be obtained from ${f.dayToDayNeedsLocation || 'the locality'}` : f.dayToDayNeeds === 'Partially' ? 'are partly available within the locality' : 'must be obtained from outside the immediate locality'}.`)
      if (f.transportFrequency) parts.push(`${f.transportFrequency} public transport services operate${f.transportRoad ? ` along ${f.transportRoad}` : ' in the area'}${f.distanceToTransport ? `, approximately ${f.distanceToTransport} from the property` : ''}.`)
      return parts.join(' ')
    }
    if (section === 'mandatoryRequirements')
      return `The property is identified under Assessment No. ${f.assessmentNumber || '—'} within the jurisdiction of ${f.localAuthorityName || 'the relevant local authority'}. The survey plan is recorded as ${f.planApprovedByLA === 'Yes' ? 'approved' : f.planApprovedByLA === 'No' ? 'not approved' : 'pending confirmation'}${f.planApprovalRef ? ` under Reference No. ${f.planApprovalRef}` : ''}${f.planApprovalDate ? ` dated ${f.planApprovalDate}` : ''}${f.planApprovalPurpose ? ` for ${f.planApprovalPurpose.toLowerCase()} purposes` : ''}.`
    if (section === 'streetLineBuildingLimits') {
      const authority = f.assessmentAuthority || f.localAuthorityName || 'the relevant local authority'
      return `According to the information issued by ${authority}${f.assessmentLetterDate ? ` under the assessment letter dated ${f.assessmentLetterDate}` : ''}${f.streetLineCertDate ? ` and the Street Line / Building Limit Certificate dated ${f.streetLineCertDate}` : ''}, the property is ${f.affectedByStreetLines === 'Yes' ? 'affected' : f.affectedByStreetLines === 'No' ? 'not affected' : 'not confirmed as affected'} by street lines and ${f.affectedByBuildingLimits === 'Yes' ? 'affected' : f.affectedByBuildingLimits === 'No' ? 'not affected' : 'not confirmed as affected'} by building limits.${f.distFromMainRoad ? ` It lies approximately ${f.distFromMainRoad} ft from the main road centreline.` : ''}${f.distFromByRoad ? ` It lies approximately ${f.distFromByRoad} ft from the by-road centreline.` : ''}`
    }
    if ((section as string) === 'localityDescription') {
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
    if ((section as string) === 'mandatoryRequirements') {
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
    if ((section as string) === 'streetLineBuildingLimits') {
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
        area: String(c.area ?? ''),
        note: String(c.note ?? ''),
        propertyType: String(c.propertyType ?? ''),
        roadAccess: String(c.roadAccess ?? ''),
        extentPerches: Number(c.extentPerches) || 0,
        distanceKm: Number(c.distanceKm) || 0,
        pricePerPerch: Number(c.pricePerPerch) || 0,
        evidenceType: 'Nearby Comparable Land',
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
