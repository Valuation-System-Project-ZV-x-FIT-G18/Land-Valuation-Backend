import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import { REPORT_TEMPLATE, NUM_TO_KEY, IMAGE_MARKERS } from './report-template'

type Row = Record<string, any>

// Format a date as "04TH JULY 2021" (the report's required style).
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
function fmtDate(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const day = d.getDate()
  const suf = day % 10 === 1 && day !== 11 ? 'ST' : day % 10 === 2 && day !== 12 ? 'ND' : day % 10 === 3 && day !== 13 ? 'RD' : 'TH'
  return `${String(day).padStart(2, '0')}${suf} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// Assembles the editable "Create Draft" valuation report by pulling together
// everything captured for a project and mapping it to the report's placeholders.
@Injectable()
export class DraftService implements OnModuleInit {
  private readonly logger = new Logger(DraftService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.query(`CREATE TABLE IF NOT EXISTS drafts (
        id SERIAL PRIMARY KEY, project_id VARCHAR(20) NOT NULL UNIQUE,
        data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
      await this.db.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'draft'`)
    } catch (err) {
      this.logger.error(`Draft setup failed: ${(err as Error).message}`)
    }
  }

  private field(p: Row, key: string, column: string): string {
    const col = p[column]
    if (col !== null && col !== undefined && String(col) !== '') return String(col)
    return String(p.details?.[key] ?? '')
  }

  // Fill the report template: replace every #N token with its mapped value.
  async fill(projectId: string): Promise<{ text: string } | { error: string }> {
    const vals = await this.buildValues(projectId)
    if (!vals) return { error: 'Project not found.' }
    const text = REPORT_TEMPLATE.replace(/#\s*(\d+)/g, (_m, num) => {
      const n = Number(num)
      if (IMAGE_MARKERS[n]) return IMAGE_MARKERS[n]
      const key = NUM_TO_KEY[n]
      if (!key) return `#${n}`
      const v = vals[key]
      return v && String(v).trim() ? String(v) : '________'
    })
    return { text }
  }

  async buildValues(projectId: string) {
    const id = projectId.trim()
    const pr = await this.db.query(`SELECT * FROM projects WHERE project_id = $1`, [id])
    const p = pr.rows[0]
    if (!p) return null
    p.details = p.details ?? {}
    const f = (k: string, c: string) => this.field(p, k, c)

    const desc = ((await this.db.query(`SELECT data FROM descriptions WHERE project_id = $1`, [id])).rows[0]?.data ?? {}) as Row
    const la = ((await this.db.query(`SELECT data FROM land_analyses WHERE project_id = $1`, [id])).rows[0]?.data ?? {}) as Row
    const map = ((await this.db.query(`SELECT lat, lng, access_description FROM map_analyses WHERE project_id = $1`, [id])).rows[0] ?? {}) as Row
    const insp = ((await this.db.query(`SELECT data FROM inspections WHERE project_id = $1`, [id])).rows[0]?.data ?? {}) as Row
    const appl = ((await this.db.query(
      `SELECT first_name, last_name, initials, phone, address, city FROM users WHERE nic = $1 AND role = 'Loan Applicant' LIMIT 1`,
      [p.applicant_nic],
    )).rows[0] ?? {}) as Row
    // Bank + branch come from the valuation the coordinator raised (bankName /
    // branchName stored on its details), not the deprecated `banks` table.
    const vd = ((await this.db.query(
      `SELECT details FROM valuations WHERE project_id = $1 ORDER BY valuation_id DESC LIMIT 1`, [id],
    )).rows[0]?.details ?? {}) as Row
    const bank = { bank_name: vd.bankName ?? '', branch_name: vd.branchName ?? '' } as Row
    const photoRows = (await this.db.query(`SELECT photo_type, description FROM site_photos WHERE project_id = $1`, [id])).rows
    const photo = (t: string) => String(photoRows.find((r: Row) => r.photo_type === t)?.description ?? '')

    const surveyDate = fmtDate(f('surveyPlanDate', 'survey_plan_date'))
    const ownerName = `${appl.first_name ?? ''} ${appl.last_name ?? ''}`.trim() || f('ownerNameAsPerDeed', 'owner_name_as_per_deed')
    const summary = (la.summary ?? {}) as Row
    const calc = (la.calculation ?? {}) as Row
    const propertyAddress = [f('propertyNumber', 'property_number'), f('streetName', 'street_name'), f('villageTown', 'village_town'), f('district', 'district')].filter(Boolean).join(', ')

    return {
      projectId: id,
      landName: f('landTraditionalName', 'land_traditional_name'),
      ownerName,
      // "Name with initials" of the applicant (from registration); falls back to the full name.
      nameWithInitials: String(appl.initials ?? '').trim() || ownerName,
      addressLine1: appl.address ?? '',
      addressLine2: '',
      // The property address split into two lines for the cover page.
      propAddressLine1: f('propertyNumber', 'property_number'),
      propAddressLine2: f('streetName', 'street_name'),
      ownerCity: appl.city ?? '',
      district: f('district', 'district'),
      bankName: bank.bank_name ?? f('bankName', 'bank_name'),
      branchName: bank.branch_name ?? '',
      contactNo: appl.phone ?? '',
      // Survey plan (used everywhere the plan is cited)
      lotNo: f('lotNumber', 'lot_number'),
      surveyPlanNo: f('surveyPlanNumber', 'survey_plan_number'),
      surveyDate,
      surveyorName: f('surveyorName', 'surveyor_name'),
      valuationRequestDate: fmtDate(f('bankRequestDate', 'bank_request_date') || (p.created_at ? String(p.created_at).slice(0, 10) : '')),
      // Property
      propertyLocationCity: f('villageTown', 'village_town'),
      urbanCouncil: f('localAuthorityName', 'local_authority_name'),
      propertyType: f('propertyType', 'property_type'),
      propertyAddress,
      presentedParty: String(insp.presentedParty ?? '') || ownerName,
      inspectionDate: fmtDate(String(insp.inspectionDate ?? '') || new Date().toISOString().slice(0, 10)),
      valuationDate: fmtDate(summary.valuationDate ?? new Date().toISOString().slice(0, 10)),
      // Values
      marketValue: String(summary.marketValue ?? ''),
      marketValueWords: summary.marketValueWords ?? '',
      forcedSaleValue: String(summary.forcedSaleValue ?? ''),
      forcedSaleValueWords: summary.forcedSaleValueWords ?? '',
      // Deed
      deedNo: f('deedNumber', 'deed_number'),
      deedDate: fmtDate(f('deedDate', 'deed_date')),
      attorney: f('attorneyName', 'attorney_name'),
      notary: f('notaryNoLocation', 'notary_no_location'),
      // Extent per survey plan
      extentAcres: f('extentAcres', 'extent_acres'),
      extentRoods: f('extentRoods', 'extent_roods'),
      extentPerches: f('extentPerches', 'extent_perches'),
      extentHectares: f('extentHectares', 'extent_hectares'),
      // Extent per deed
      deedAcres: f('deedExtentAcres', 'deed_extent_acres'),
      deedRoods: f('deedExtentRoods', 'deed_extent_roods'),
      deedPerches: f('deedExtentPerches', 'deed_extent_perches'),
      deedHectares: f('deedExtentHectares', 'deed_extent_hectares'),
      // Validity of survey plan
      planOver10Years: f('planOlderThan10', 'plan_older_than_10'),
      planEndorsementOrNew: f('planActionIfOld', 'plan_action_if_old'),
      // Boundaries per survey plan
      boundaryNorth: f('boundaryNorth', 'boundary_north'),
      boundaryEast: f('boundaryEast', 'boundary_east'),
      boundarySouth: f('boundarySouth', 'boundary_south'),
      boundaryWest: f('boundaryWest', 'boundary_west'),
      // Boundaries per site visit (inspection)
      siteBoundaryNorth: String(insp.northBoundary ?? ''),
      siteBoundaryEast: String(insp.eastBoundary ?? ''),
      siteBoundarySouth: String(insp.southBoundary ?? ''),
      siteBoundaryWest: String(insp.westBoundary ?? ''),
      accessFromBoundary: f('rightOfWayFrom', 'right_of_way_from'),
      // GPS & map
      accessLocationDescription: map.access_description ?? '',
      gpsCoordinates: map.lat != null ? `${map.lat}, ${map.lng}` : '',
      // Narrative descriptions
      localityDescription: desc.localityDescription ?? '',
      landDescription: desc.landDescription ?? '',
      legalDescription: desc.legalParagraph ?? '',
      localAuthorityTax: desc.localAuthorityTax ?? '',
      streetLineBuildingLimits: desc.streetLineBuildingLimits ?? '',
      mandatoryRequirements: desc.mandatoryRequirements ?? '',
      localityFacilities: desc.localityFacilities ?? '',
      nearbyPropertyDetails: la.evidence?.marketSurveyStatement ?? '',
      previouslyValued: (la.basis?.previouslyValued ?? 'not valued').includes('previously') ? 'valued' : 'not valued',
      valuationText:
        calc.ratePerPerch
          ? `${calc.totalExtentPerches ?? ''} Perches @ Rs. ${Number(calc.ratePerPerch).toLocaleString('en-US')}/- per perch = Rs. ${Number(calc.marketValue ?? 0).toLocaleString('en-US')}/-.`
          : '',
      conclusion: desc.conclusion ?? '',
      // Valuation/evidence tables the officer edited & saved in Generate Descriptions
      savedValuation: desc.valuation ?? '',
      savedEvidence: desc.evidence ?? '',
      imageAnalysis: desc.imageAnalysis ?? '',
      // Photo descriptions
      photoAccessRoad: photo('accessRoad'),
      photoRouteFromMainRoad: photo('routeFromMainRoad'),
      photoFrontView: photo('frontView'),
      photoRearView: photo('rearView'),
      photoLeftSide: photo('leftSideView'),
      photoRightSide: photo('rightSideView'),
      photoEastBoundary: photo('eastBoundary'),
      photoSouthBoundary: photo('southBoundary'),
      photoWestBoundary: photo('westBoundary'),
      photoNorthBoundary: photo('northBoundary'),
    } as Record<string, string>
  }

  async get(projectId: string) {
    const r = await this.db.query(`SELECT data FROM drafts WHERE project_id = $1`, [projectId.trim()])
    return (r.rows[0]?.data as Record<string, string>) ?? null
  }

  // Saving the draft submits it for the L3 check: it is stored, the review
  // status becomes "pending_l3", the project moves forward, and the L3 managers
  // + the loan applicant are notified. Re-saving while it is already further
  // along (with L2/L1/locked) keeps that status and does not re-notify.
  async save(projectId: string, data: Record<string, string>) {
    const p = (projectId ?? '').trim()
    if (!p) return { ok: false, error: 'Missing project.' }

    const prev =
      (await this.db.query(`SELECT review_status FROM drafts WHERE project_id = $1`, [p]))
        .rows[0]?.review_status ?? ''

    // Fresh drafts (or ones sent back to the TO) go to pending_l3; anything
    // already with L2/L1/locked keeps its status.
    await this.db.query(
      `INSERT INTO drafts (project_id, data, review_status)
       VALUES ($1, $2::jsonb, 'pending_l3')
       ON CONFLICT (project_id) DO UPDATE SET
         data = COALESCE(drafts.data, '{}'::jsonb) || $2::jsonb,
         review_status = CASE WHEN drafts.review_status IN ('', 'draft', 'rejected_to_to')
                              THEN 'pending_l3' ELSE drafts.review_status END,
         created_at = now()`,
      [p, JSON.stringify(data ?? {})],
    )

    // Only run the submit side-effects when it FIRST reaches L3.
    const firstSubmit = ['', 'draft', 'rejected_to_to'].includes(prev)
    if (firstSubmit) {
      await this.db.query(`UPDATE projects SET status = $1 WHERE project_id = $2`, ['Draft Submitted — L3 Check', p])
      // The officer has finished their work → free them (back to Available) by
      // moving the valuation out of the "Technical Officer Assigned" state.
      await this.db.query(
        `UPDATE valuations SET status = 'Draft Submitted'
           WHERE project_id = $1 AND status = 'Technical Officer Assigned'`,
        [p],
      )
      await this.notifyOnSubmit(p)
    }
    return { ok: true }
  }

  // On first submission: notify the L3 managers, and email + notify the applicant.
  private async notifyOnSubmit(projectId: string) {
    try {
      const nic = (await this.db.query(`SELECT applicant_nic FROM projects WHERE project_id = $1`, [projectId]))
        .rows[0]?.applicant_nic as string | undefined
      if (nic) {
        await this.notifications.create(
          nic,
          `Your valuation report for project ${projectId} has been prepared and is now under review (L3 check).`,
        )
        const email = (await this.db.query(
          `SELECT email FROM users WHERE nic = $1 AND role = 'Loan Applicant' LIMIT 1`, [nic],
        )).rows[0]?.email as string | undefined
        if (email) await this.mail.sendDraftUnderReview(email, projectId)
      }
      const l3 = await this.db.query(`SELECT user_id FROM users WHERE role = 'Manager L3'`)
      for (const m of l3.rows as Row[]) {
        await this.notifications.create(
          m.user_id as string,
          `A valuation draft for project ${projectId} is ready for your L3 check.`,
        )
      }
    } catch (err) {
      this.logger.error(`Draft submit notifications failed: ${(err as Error).message}`)
    }
  }
}
