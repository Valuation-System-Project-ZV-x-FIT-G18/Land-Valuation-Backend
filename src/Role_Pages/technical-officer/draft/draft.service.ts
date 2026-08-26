//06
import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import { MailService } from '../../../Common_Pages/mail/mail.service'
import { NotificationsService } from '../../../Common_Pages/notifications/notifications.service'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

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

// A timestamp column arrives as a JS Date. String(date).slice(0, 10) yields
// "Tue Aug 25", which fmtDate then reparses into the year 2001 (V8's default
// for a date with no year). Go through the ISO form instead.
function isoDay(value: unknown): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(String(value))
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}


// Sri Lankan land extents are recorded as Acres-Roods-Perches; the hectare
// figure the report also prints is simply the same measurement in metric.
// It was an optional number field on the project form, so it was usually left
// blank and the report went to the bank reading "Hectares: [ To be filled ]".
// Deriving it removes both the retyping and the chance of a mismatch.
// 1 acre = 4 roods = 160 perches, 1 perch = 25.29285264 m².
function hectaresFrom(acres: unknown, roods: unknown, perches: unknown): string {
  const totalPerches =
    (Number(acres) || 0) * 160 + (Number(roods) || 0) * 40 + (Number(perches) || 0)
  if (totalPerches <= 0) return ''
  return (totalPerches * 25.29285264 / 10000).toFixed(4)
}

// Assembles the editable "Create Draft" valuation report by pulling together
// everything captured for a project and mapping it to the report's placeholders.
@Injectable()
export class DraftService {
  private readonly logger = new Logger(DraftService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async assertAssigned(projectId: string, user: AuthUser) {
    if (user.role !== 'Technical Officer') {
      throw new ForbiddenException('Only a technical officer can use the draft workspace.')
    }
    const project = (projectId ?? '').trim()
    const assigned = await this.db.query(
      `SELECT 1 FROM valuations WHERE project_id = $1 AND technical_officer_id = $2 LIMIT 1`,
      [project, user.userId],
    )
    if (!assigned.rowCount) throw new ForbiddenException('This project is not assigned to you.')
  }



  private field(p: Row, key: string, column: string): string {
    const col = p[column]
    if (col !== null && col !== undefined && String(col) !== '') return String(col)
    return String(p.details?.[key] ?? '')
  }

  async buildValues(projectId: string) {
    const id = projectId.trim()
    const pr = await this.db.query(`SELECT * FROM projects WHERE project_id = $1`, [id])
    const p = pr.rows[0]
    if (!p) return null
    p.details = p.details ?? {}
    const f = (k: string, c: string) => this.field(p, k, c)

    // Descriptions are generated and reviewed in Technical Officer > Generate
    // Descriptions. Create Draft only consumes that saved, officer-approved text.
    const desc = ((await this.db.query(`SELECT data FROM descriptions WHERE project_id = $1`, [id])).rows[0]?.data ?? {}) as Row
    const la = ((await this.db.query(`SELECT data FROM land_analyses WHERE project_id = $1`, [id])).rows[0]?.data ?? {}) as Row
    const map = ((await this.db.query(`SELECT lat, lng, access_description FROM map_analyses WHERE project_id = $1`, [id])).rows[0] ?? {}) as Row
    const insp = ((await this.db.query(`SELECT data FROM inspections WHERE project_id = $1`, [id])).rows[0]?.data ?? {}) as Row
    const appl = ((await this.db.query(
      `SELECT first_name, last_name, initials, applicant_business_name, phone, address, city FROM users WHERE nic = $1 AND role = 'Loan Applicant' LIMIT 1`,
      [p.applicant_nic],
    )).rows[0] ?? {}) as Row
    // Bank + branch come from the valuation the coordinator raised (bankName /
    // branchName stored on its details), not the deprecated `banks` table.
    const vd = ((await this.db.query(
      `SELECT details FROM valuations WHERE project_id = $1 ORDER BY valuation_id DESC LIMIT 1`, [id],
    )).rows[0]?.details ?? {}) as Row
    // The branch's city lives on the branch record, keyed by the branch code
    // the coordinator picked. Reading it here means the report always shows
    // the registered city rather than a value re-typed per valuation.
    const branchCity = ((await this.db.query(
      `SELECT city FROM bank_branches WHERE branch_code = $1 LIMIT 1`,
      [String(vd.bankBranchCode ?? '').trim()],
    )).rows[0]?.city ?? '') as string
    const bank = {
      bank_name: vd.bankName ?? '',
      branch_name: vd.branchName ?? '',
      branch_city: branchCity,
    } as Row
    const valuer = ((await this.db.query(
      `SELECT vp.* FROM valuer_profiles vp
         JOIN users u ON u.user_id = vp.user_id
        WHERE u.role = 'Manager L1'
        ORDER BY vp.updated_at DESC LIMIT 1`,
    )).rows[0] ?? {}) as Row
    const surveyDate = fmtDate(f('surveyPlanDate', 'survey_plan_date'))
    const ownerName = `${appl.first_name ?? ''} ${appl.last_name ?? ''}`.trim() || f('ownerNameAsPerDeed', 'owner_name_as_per_deed')
    const summary = (la.summary ?? {}) as Row
    const draftData = ((await this.db.query(`SELECT data FROM drafts WHERE project_id = $1`, [id])).rows[0]?.data ?? {}) as Row
    const calc = (la.calculation ?? {}) as Row
    const propertyAddress = [f('propertyNumber', 'property_number'), f('streetName', 'street_name'), f('villageTown', 'village_town'), f('district', 'district')].filter(Boolean).join(', ')
    const extentsTally = f('extentsTally', 'extents_tally').trim().toLowerCase()
    // Narrative sections come from the Descriptions step only. Stitching a
    // paragraph together from the inspection answers here put template prose
    // into the report before anything had tried to write it — indistinguishable
    // from generated text, and produced even when the AI was perfectly
    // available. With no saved description the report shows its "to be filled"
    // marker instead, which is honest about the state of the report.
    const localityFacilities = desc.localityFacilities || desc.localityDescription || map.locality_description || ''
    // Same rule: the saved description, or the conclusion the nearby analysis
    // generated. No locally invented sentence.
    const conclusion = desc.conclusion || la.conclusion?.text || ''
    const extentVerificationStatement = ['yes', 'true', 'tally', 'tallies'].includes(extentsTally)
      ? 'The extent mentioned in the above survey plan tallies with the above deed.'
      : ['no', 'false', 'do not tally', 'does not tally'].includes(extentsTally)
        ? 'The extent mentioned in the above survey plan does not tally with the above deed and requires further verification.'
        : extentsTally
          ? `The correspondence between the survey plan and deed extents is recorded as: ${f('extentsTally', 'extents_tally')}.`
          : ''
    const planOver10Years = f('planOlderThan10', 'plan_older_than_10')
    const configuredPlanAction = f('planActionIfOld', 'plan_action_if_old')
    const surveyPlanRequiredAction = /^(no|false)$/i.test(planOver10Years.trim())
      ? 'Not required'
      : configuredPlanAction
    const hasMapCoordinates = map.lat != null && map.lng != null
    const mapLat = Number(map.lat)
    const mapLng = Number(map.lng)
    const mapDelta = 0.0025
    const satelliteLocationImage = hasMapCoordinates
      ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${mapLng - mapDelta},${mapLat - mapDelta},${mapLng + mapDelta},${mapLat + mapDelta}&bboxSR=4326&size=360,260&format=png&f=image`
      : ''
    const locationMapImage = hasMapCoordinates
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${mapLat},${mapLng}&zoom=16&size=360x260&markers=${mapLat},${mapLng},red`
      : ''
    const sitePhotoUrl = (type: string) =>
      `/api/technical-officer/site-photos/file?projectId=${encodeURIComponent(id)}&photoType=${encodeURIComponent(type)}`
    const comparables = Array.isArray(la.evidence?.comparables) ? (la.evidence.comparables as Row[]) : []
    const comparableValue = (index: number, key: string) => String(comparables[index]?.[key] ?? '')
    const comparableDetails = (index: number) => {
      const c = comparables[index]
      if (!c) return ''
      const distance = Number(c.distanceKm) > 0
        ? Number(c.distanceKm) < 1
          ? `${Math.round(Number(c.distanceKm) * 1000)} metres from the subject property`
          : `${Number(c.distanceKm).toFixed(2)} km from the subject property`
        : ''
      return [
        c.area && `Location: ${c.area}`,
        c.saleDate && `Date: ${fmtDate(String(c.saleDate))}`,
        Number(c.extentPerches) > 0 && `Extent: ${c.extentPerches} perches`,
        distance,
        c.propertyType && `Property type: ${c.propertyType}`,
        c.roadAccess && `Road access: ${c.roadAccess}`,
        c.source && `Source: ${c.source}`,
        c.note,
      ].filter(Boolean).join('; ')
    }

    return {
      // Preserve every saved inspection field under its form key so the live
      // builder and regenerated report use the same complete inspection data.
      ...Object.fromEntries(Object.entries(insp).map(([key, value]) => [key, String(value ?? '')])),
      projectId: id,
      landName: f('landTraditionalName', 'land_traditional_name'),
      ownerName,
      applicantFullName: ownerName,
      propertyOwnerName: ownerName,
      ownershipType: f('ownershipType', 'ownership_type'),
      // "Name with initials" of the applicant (from registration); falls back to the full name.
      nameWithInitials: String(appl.initials ?? '').trim() || ownerName,
      applicantBusinessName: String(appl.applicant_business_name ?? ''),
      applicantContactNumber: String(appl.phone ?? ''),
      addressLine1: appl.address ?? '',
      addressLine2: '',
      ownerAddress: [appl.address, appl.city].filter(Boolean).join(', '),
      // The property address split into two lines for the cover page.
      propAddressLine1: f('propertyNumber', 'property_number'),
      propAddressLine2: f('streetName', 'street_name'),
      propertyCity: f('propertyCity', 'property_city'),
      ownerCity: appl.city ?? '',
      district: f('district', 'district'),
      bankName: bank.bank_name ?? f('bankName', 'bank_name'),
      branchName: bank.branch_name ?? '',
      bankBranchName: bank.branch_name ?? '',
      bankBranchCity: bank.branch_city ?? '',
      contactNo: appl.phone ?? '',
      // Survey plan (used everywhere the plan is cited)
      lotNo: f('lotNumber', 'lot_number'),
      lotNumber: f('lotNumber', 'lot_number'),
      surveyPlanNo: f('surveyPlanNumber', 'survey_plan_number'),
      surveyPlanNumber: f('surveyPlanNumber', 'survey_plan_number'),
      surveyDate,
      surveyPlanDate: surveyDate,
      surveyorName: f('surveyorName', 'surveyor_name'),
      valuationRequestDate: fmtDate(
        f('bankRequestDate', 'bank_request_date') ||
        String(vd.bankRequestDate ?? '') ||
        isoDay(p.created_at),
      ),
      // Property
      propertyLocationCity: f('villageTown', 'village_town'),
      propertyNumber: f('propertyNumber', 'property_number'),
      propertyStreetName: f('streetName', 'street_name'),
      propertyVillageTown: f('villageTown', 'village_town'),
      urbanCouncil: f('localAuthorityName', 'local_authority_name'),
      propertyType: f('propertyType', 'property_type'),
      propertyAddress,
      presentedParty: String(insp.presentedParty ?? '') || ownerName,
      inspectionDate: fmtDate(String(insp.inspectionDate ?? '') || new Date().toISOString().slice(0, 10)),
      valuationDate: fmtDate(draftData.valuationDate ?? summary.valuationDate ?? new Date().toISOString().slice(0, 10)),
      // Values
      marketValue: String(summary.marketValue ?? ''),
      marketValueWords: summary.marketValueWords ?? '',
      forcedSaleValue: String(summary.forcedSaleValue ?? ''),
      forcedSaleValueWords: summary.forcedSaleValueWords ?? '',
      forcedSalePct: String(summary.forcedSalePct ?? 80),
      // Deed
      deedType: f('deedType', 'deed_type'),
      deedNo: f('deedNumber', 'deed_number'),
      deedNumber: f('deedNumber', 'deed_number'),
      deedDate: fmtDate(f('deedDate', 'deed_date')),
      attorney: f('attorneyName', 'attorney_name'),
      attorneyName: f('attorneyName', 'attorney_name'),
      notary: f('notaryNoLocation', 'notary_no_location'),
      notaryLocation: f('notaryNoLocation', 'notary_no_location'),
      // Extent per survey plan
      extentAcres: f('extentAcres', 'extent_acres'),
      extentRoods: f('extentRoods', 'extent_roods'),
      extentPerches: f('extentPerches', 'extent_perches'),
      extentHectares:
        f('extentHectares', 'extent_hectares') ||
        hectaresFrom(f('extentAcres', 'extent_acres'), f('extentRoods', 'extent_roods'), f('extentPerches', 'extent_perches')),
      // Extent per deed
      deedAcres: f('deedExtentAcres', 'deed_extent_acres'),
      deedRoods: f('deedExtentRoods', 'deed_extent_roods'),
      deedPerches: f('deedExtentPerches', 'deed_extent_perches'),
      deedHectares:
        f('deedExtentHectares', 'deed_extent_hectares') ||
        hectaresFrom(f('deedExtentAcres', 'deed_extent_acres'), f('deedExtentRoods', 'deed_extent_roods'), f('deedExtentPerches', 'deed_extent_perches')),
      deedExtentAcres: f('deedExtentAcres', 'deed_extent_acres'),
      deedExtentRoods: f('deedExtentRoods', 'deed_extent_roods'),
      deedExtentPerches: f('deedExtentPerches', 'deed_extent_perches'),
      deedExtentHectares: f('deedExtentHectares', 'deed_extent_hectares'),
      extentVerificationStatement,
      // Validity of survey plan
      planOver10Years,
      planOlderThan10Years: planOver10Years,
      surveyPlanRequiredAction,
      planEndorsementOrNew: surveyPlanRequiredAction,
      surveyPlanImage: `/api/coordinator/projects/file?projectId=${encodeURIComponent(id)}&type=surveyPlan`,
      // Boundaries per survey plan
      boundaryNorth: f('boundaryNorth', 'boundary_north'),
      boundaryNorthOnPlan: f('boundaryNorth', 'boundary_north'),
      boundaryEast: f('boundaryEast', 'boundary_east'),
      boundaryEastOnPlan: f('boundaryEast', 'boundary_east'),
      boundarySouth: f('boundarySouth', 'boundary_south'),
      boundarySouthOnPlan: f('boundarySouth', 'boundary_south'),
      boundaryWest: f('boundaryWest', 'boundary_west'),
      boundaryWestOnPlan: f('boundaryWest', 'boundary_west'),
      // Boundaries per site visit (inspection)
      siteBoundaryNorth: String(insp.northBoundary ?? ''),
      boundaryNorthOnSite: String(insp.northBoundary ?? ''),
      siteBoundaryEast: String(insp.eastBoundary ?? ''),
      boundaryEastOnSite: String(insp.eastBoundary ?? ''),
      siteBoundarySouth: String(insp.southBoundary ?? ''),
      boundarySouthOnSite: String(insp.southBoundary ?? ''),
      siteBoundaryWest: String(insp.westBoundary ?? ''),
      boundaryWestOnSite: String(insp.westBoundary ?? ''),
      accessFromBoundary: f('rightOfWayFrom', 'right_of_way_from'),
      // GPS & map
      accessLocationDescription: desc.accessDescription ?? map.access_description ?? '',
      gpsCoordinates: map.lat != null ? `${map.lat}, ${map.lng}` : '',
      latitude: map.lat != null ? String(map.lat) : f('latitude', 'latitude'),
      longitude: map.lng != null ? String(map.lng) : f('longitude', 'longitude'),
      accessRoadWidth: String(insp.roadWidth ?? ''),
      accessRoadSurface: String(insp.roadType ?? ''),
      legalRightOfWay: String(insp.rightOfWay ?? '') || f('rightOfWayAvailable', 'right_of_way_available'),
      landShape: String(insp.landShape ?? ''),
      landPosition: String(insp.landPosition ?? ''),
      frontage: String(insp.frontage ?? ''),
      floodProne: String(insp.floodProne ?? ''),
      soilType: String(insp.soilType ?? ''),
      drainage: String(insp.drainage ?? ''),
      gateType: String(insp.gateType ?? ''),
      unauthorizedStructures: String(insp.unauthorizedStructures ?? ''),
      satelliteLocationImage,
      locationMapImage,
      // Narrative descriptions
      requestDescription: desc.requestDescription ?? '',
      limitations: desc.limitations ?? '',
      generalAssumptions: desc.generalAssumptions ?? '',
      localityDescription: desc.situation ?? '',
      extentDescription: desc.extentDescription ?? '',
      landDescription: desc.landDescription ?? '',
      legalDescription: desc.legalParagraph || desc.ownershipDescription || '',
      localAuthorityTax: desc.localAuthorityTax ?? '',
      streetLineBuildingLimits: desc.streetLineBuildingLimits ?? '',
      mandatoryRequirements: desc.mandatoryRequirements ?? '',
      // Named Word-template aliases and their raw planning values.
      surveyPlanApprovalStatement: desc.mandatoryRequirements ?? '',
      planningRestrictionsStatement: desc.streetLineBuildingLimits ?? '',
      planApprovedByLA: f('planApprovedByLA', 'plan_approved_by_la'),
      planApprovalRef: f('planApprovalRef', 'plan_approval_ref'),
      planApprovalDate: fmtDate(f('planApprovalDate', 'plan_approval_date')),
      planApprovalPurpose: f('planApprovalPurpose', 'plan_approval_purpose'),
      localAuthorityName: f('localAuthorityName', 'local_authority_name'),
      planningAuthority: f('planningAuthority', 'planning_authority'),
      affectedByStreetLines: f('affectedByStreetLines', 'affected_by_street_lines'),
      affectedByBuildingLimits: f('affectedByBuildingLimits', 'affected_by_building_limits'),
      distFromMainRoad: f('distFromMainRoad', 'dist_from_main_road'),
      distFromByRoad: f('distFromByRoad', 'dist_from_by_road'),
      rentControlRegulation: desc.rentControlRegulation ?? '',
      localityFacilities,
      certification: desc.certification ?? '',
      nearbyPropertyDetails: la.evidence?.marketSurveyStatement ?? '',
      comparable1Reference: comparableValue(0, 'refNo'),
      comparable1RefNo: comparableValue(0, 'refNo'),
      comparable1Area: comparableValue(0, 'area'),
      comparable1Date: fmtDate(comparableValue(0, 'saleDate')),
      comparable1Extent: comparableValue(0, 'extentPerches'),
      comparable1Distance: comparableValue(0, 'distanceKm'),
      comparable1PropertyType: comparableValue(0, 'propertyType'),
      comparable1RoadAccess: comparableValue(0, 'roadAccess'),
      comparable1Source: comparableValue(0, 'source'),
      comparable1Details: comparableDetails(0),
      comparable1PricePerPerch: comparableValue(0, 'pricePerPerch'),
      comparable2Reference: comparableValue(1, 'refNo'),
      comparable2RefNo: comparableValue(1, 'refNo'),
      comparable2Area: comparableValue(1, 'area'),
      comparable2Date: fmtDate(comparableValue(1, 'saleDate')),
      comparable2Extent: comparableValue(1, 'extentPerches'),
      comparable2Distance: comparableValue(1, 'distanceKm'),
      comparable2PropertyType: comparableValue(1, 'propertyType'),
      comparable2RoadAccess: comparableValue(1, 'roadAccess'),
      comparable2Source: comparableValue(1, 'source'),
      comparable2Details: comparableDetails(1),
      comparable2PricePerPerch: comparableValue(1, 'pricePerPerch'),
      comparable3Reference: comparableValue(2, 'refNo'),
      comparable3RefNo: comparableValue(2, 'refNo'),
      comparable3Area: comparableValue(2, 'area'),
      comparable3Date: fmtDate(comparableValue(2, 'saleDate')),
      comparable3Extent: comparableValue(2, 'extentPerches'),
      comparable3Distance: comparableValue(2, 'distanceKm'),
      comparable3PropertyType: comparableValue(2, 'propertyType'),
      comparable3RoadAccess: comparableValue(2, 'roadAccess'),
      comparable3Source: comparableValue(2, 'source'),
      comparable3Details: comparableDetails(2),
      comparable3PricePerPerch: comparableValue(2, 'pricePerPerch'),
      valuationApproachStatement: `In assessing the subject land, I have applied the Direct Comparison Method under the Market Approach. The available sales and asking-price evidence of comparable lands has been analysed with appropriate consideration of location, extent, access, shape, physical characteristics, planning restrictions and prevailing market conditions.`,
      previouslyValued: (la.basis?.previouslyValued ?? 'not valued').includes('previously') ? 'valued' : 'not valued',
      valuationText:
        calc.ratePerPerch
          ? `${calc.totalExtentPerches ?? ''} Perches @ Rs. ${Number(calc.ratePerPerch).toLocaleString('en-US')}/- per perch = Rs. ${Number(calc.marketValue ?? 0).toLocaleString('en-US')}/-.`
          : '',
      conclusion,
      valuerName: String(valuer.valuer_name ?? ''),
      valuerProfessionalQualifications: String(valuer.professional_qualifications ?? ''),
      valuerIvslNumber: String(valuer.ivsl_registration_number ?? ''),
      valuerRicsNumber: String(valuer.rics_registration_number ?? ''),
      valuerRicsRegistrationNumber: String(valuer.rics_registration_number ?? ''),
      valuerRicsMembership: String(valuer.rics_membership ?? ''),
      // Valuation/evidence tables the officer edited & saved in Generate Descriptions
      savedValuation: desc.valuation ?? '',
      savedEvidence: desc.evidence ?? '',
      imageAnalysis: desc.imageAnalysis ?? '',
      // Named Word-template image placeholders. Descriptions are deliberately
      // not used as image values.
      photoAccessRoad: sitePhotoUrl('accessRoad'),
      photoRouteFromMainRoad: sitePhotoUrl('routeFromMainRoad'),
      photoFrontView: sitePhotoUrl('frontView'),
      photoRearView: sitePhotoUrl('rearView'),
      photoLeftSide: sitePhotoUrl('leftSideView'),
      photoRightSide: sitePhotoUrl('rightSideView'),
      photoNorthBoundary: sitePhotoUrl('northBoundary'),
      photoEastBoundary: sitePhotoUrl('eastBoundary'),
      photoSouthBoundary: sitePhotoUrl('southBoundary'),
      photoWestBoundary: sitePhotoUrl('westBoundary'),
      photoGateEntrance: sitePhotoUrl('gateEntrance'),
      photoDrainage: sitePhotoUrl('drainage'),
      photoRoadFrontage: sitePhotoUrl('roadFrontage'),
      photoSoilCondition: sitePhotoUrl('soilCondition'),
      photoUnauthorizedStructures: sitePhotoUrl('unauthorizedStructures'),
      photoFloodEvidence: sitePhotoUrl('floodEvidence'),
      photoNotableFeatures: sitePhotoUrl('notableFeatures'),
      photoSurroundingArea: sitePhotoUrl('surroundingArea'),
      photoNearbyFacilities: sitePhotoUrl('nearbyFacilities'),
    } as Record<string, string>
  }

  async get(projectId: string) {
    const r = await this.db.query(`SELECT data FROM drafts WHERE project_id = $1`, [projectId.trim()])
    return (r.rows[0]?.data as Record<string, string>) ?? null
  }

  async history(projectId: string) {
    const result = await this.db.query(
      `SELECT version_number, event, review_status, actor_user_id, actor_role, reason, created_at
         FROM draft_versions WHERE project_id = $1 ORDER BY version_number DESC`,
      [(projectId ?? '').trim()],
    )
    return result.rows.map((row) => ({
      version: Number(row.version_number),
      event: String(row.event),
      reviewStatus: String(row.review_status),
      actorUserId: String(row.actor_user_id ?? ''),
      actorRole: String(row.actor_role),
      reason: String(row.reason ?? ''),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    }))
  }

  private async recordVersion(projectId: string, reportHtml: string, event: string, status: string, user: AuthUser, reason = '') {
    await this.db.query(
      `INSERT INTO draft_versions
        (project_id, version_number, report_html, event, review_status, actor_user_id, actor_role, reason)
       SELECT $1, COALESCE(MAX(version_number), 0) + 1, $2, $3, $4, $5, $6, $7
         FROM draft_versions WHERE project_id = $1`,
      [projectId, reportHtml, event, status, user.userId, user.role, reason],
    )
  }

  // Persist an editable working copy without entering the manager-review
  // workflow. Submission remains an explicit officer action.
  async autosave(projectId: string, data: Record<string, string>, user: AuthUser) {
    const p = (projectId ?? '').trim()
    if (!p) return { ok: false, error: 'Missing project.' }
    await this.assertAssigned(p, user)

    const existing = await this.db.query(`SELECT review_status FROM drafts WHERE project_id = $1`, [p])
    const status = String(existing.rows[0]?.review_status ?? '')
    if (status && !['draft', 'rejected_to_to'].includes(status)) {
      throw new ConflictException('This report is already in review and cannot be auto-saved.')
    }

    await this.db.query(
      `INSERT INTO drafts (project_id, data, review_status)
       VALUES ($1, $2::jsonb, 'draft')
       ON CONFLICT (project_id) DO UPDATE SET
         data = COALESCE(drafts.data, '{}'::jsonb) || $2::jsonb,
         created_at = now()`,
      [p, JSON.stringify(data ?? {})],
    )
    const reportHtml = String(data?.reportHtml ?? '')
    if (reportHtml) await this.recordVersion(p, reportHtml, 'submitted', 'pending_l3', user)
    return { ok: true, savedAt: new Date().toISOString() }
  }

  // Saving the draft submits it for the L3 check: it is stored, the review
  // status becomes "pending_l3", the project moves forward, and the L3 managers
  // + the loan applicant are notified. Re-saving while it is already further
  // along (with L2/L1/locked) keeps that status and does not re-notify.
  async save(projectId: string, data: Record<string, string>, user: AuthUser) {
    const p = (projectId ?? '').trim()
    if (!p) return { ok: false, error: 'Missing project.' }
    await this.assertAssigned(p, user)

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
           WHERE project_id = $1 AND status IN ('Technical Officer Assigned', 'Assignment Accepted')`,
        [p],
      )
      await this.notifyOnSubmit(p)
    }
    return { ok: true }
  }

  // On first submission: notify the L3 managers, and email + notify the
  // applicant and the requesting bank.
  private async notifyOnSubmit(projectId: string) {
    try {
      const proj = (await this.db.query(`SELECT applicant_nic, bank_email FROM projects WHERE project_id = $1`, [projectId])).rows[0] as
        | { applicant_nic?: string; bank_email?: string }
        | undefined
      const nic = proj?.applicant_nic
      if (nic) {
        await this.notifications.create(
          nic,
          `Your valuation report for project ${projectId} has been prepared and has entered our internal review process.`,
        )
        const email = (await this.db.query(
          `SELECT email FROM users WHERE nic = $1 AND role = 'Loan Applicant' LIMIT 1`, [nic],
        )).rows[0]?.email as string | undefined
        if (email) await this.mail.sendDraftUnderReview(email, projectId)
      }
      const bankEmail = proj?.bank_email ?? ''
      if (bankEmail) {
        const bankUserId = await this.notifications.resolveBankUserId(bankEmail)
        if (bankUserId) {
          await this.notifications.create(
            bankUserId,
            `The valuation report for project ${projectId} has been prepared and has entered our internal review process.`,
          )
        }
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
