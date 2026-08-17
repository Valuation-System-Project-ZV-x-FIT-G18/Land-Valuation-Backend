import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import pg from 'pg'

const { Client } = pg
const envPath = path.join(process.cwd(), '.env')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
)

const BATCH = 'learning-description-ready-20260816'
const APPLICANT_NIC = '222222222222'
const BANK_CODE = '000614'
const BANK_EMAIL = 'pranidimethmini@gmail.com'
const TO_ID = 'TO001'
const client = new Client({ connectionString: env.DATABASE_URL })

await client.connect()
try {
  await client.query('BEGIN')
  const existing = await client.query(
    `SELECT project_id FROM projects WHERE details->>'seedBatch' = $1 LIMIT 1`,
    [BATCH],
  )
  if (existing.rows[0]) {
    const projectId = existing.rows[0].project_id
    await client.query(`DELETE FROM drafts WHERE project_id = $1`, [projectId])
    await client.query(
      `DELETE FROM notifications WHERE message ILIKE $1`,
      [`%${projectId}%`],
    )
    await client.query(
      `UPDATE projects SET status = 'Descriptions Generated' WHERE project_id = $1`,
      [projectId],
    )
    await client.query(
      `UPDATE valuations
          SET status = 'Assignment Accepted', assignment_accepted = true
        WHERE project_id = $1 AND technical_officer_id = $2`,
      [projectId, TO_ID],
    )
    const state = await client.query(
      `SELECT
         EXISTS(SELECT 1 FROM valuations WHERE project_id = $1 AND technical_officer_id = $2 AND status = 'Assignment Accepted') AS assignment_ready,
         EXISTS(SELECT 1 FROM inspections WHERE project_id = $1) AS inspection_ready,
         EXISTS(SELECT 1 FROM map_analyses WHERE project_id = $1) AS map_ready,
         EXISTS(SELECT 1 FROM land_analyses WHERE project_id = $1) AS analysis_ready,
         EXISTS(SELECT 1 FROM descriptions WHERE project_id = $1) AS descriptions_ready,
         EXISTS(SELECT 1 FROM drafts WHERE project_id = $1) AS draft_created`,
      [projectId, TO_ID],
    )
    await client.query('COMMIT')
    console.log(JSON.stringify({ existing: true, reset: true, projectId, stoppedAt: 'Descriptions saved', ...state.rows[0] }, null, 2))
    process.exit(0)
  }

  const required = await client.query(
    `SELECT user_id, role FROM users WHERE user_id = ANY($1::text[])`,
    [[APPLICANT_NIC, BANK_CODE, TO_ID]],
  )
  if (required.rowCount !== 3) {
    throw new Error('Required test applicant, bank, or TO001 account is missing.')
  }

  const details = {
    seedBatch: BATCH,
    propertyType: 'Residential Land', propertyNumber: '45/B', streetName: 'Lake Road',
    villageTown: 'Boralesgamuwa', propertyCity: 'Boralesgamuwa', gnDivision: 'Boralesgamuwa East',
    dsDivision: 'Kesbewa', district: 'Colombo', province: 'Western Province', postalCode: '10290',
    latitude: '6.8421000', longitude: '79.9017000', landTraditionalName: 'Kahatagahawatta',
    localAuthorityType: 'Urban Council', localAuthorityName: 'Boralesgamuwa Urban Council',
    pattu: 'Palle Pattu', korale: 'Salpiti Korale', surveyPlanNumber: 'SP-LEARN-001-2026',
    surveyPlanDate: '2026-04-12', surveyorName: 'Saman Jayawardena', surveyorLicenseNo: 'LS-2458',
    lotNumber: 'Lot 03', planOlderThan10: 'No', planActionIfOld: 'Not required',
    extentAcres: '0', extentRoods: '1', extentPerches: '12', extentHectares: '0.1315',
    deedExtentAcres: '0', deedExtentRoods: '1', deedExtentPerches: '12', deedExtentHectares: '0.1315',
    extentAsPerPlan: '52 perches', extentAsPerDeed: '52 perches', extentsTally: 'Yes',
    deedType: 'Deed of Transfer', ownershipType: 'Sole Ownership', deedNumber: 'DT-8841',
    deedDate: '2026-03-05', attorneyName: 'Nimal Perera', notaryNoLocation: 'N.P. 1245, Colombo',
    ownerNameAsPerDeed: 'Kasun Maduranga Perera', previousOwnerName: 'Sunil Perera',
    boundaryNorth: 'Lot 02 in the same survey plan', boundaryEast: 'Lake Road',
    boundarySouth: 'Residential property of A. Silva', boundaryWest: 'Private access reservation',
    rightOfWayAvailable: 'Yes', assessmentNumber: 'BUC/2026/4512', assessmentLetterDate: '2026-05-10',
    planApprovedByLa: 'Yes', planApprovalRef: 'BUC/PLAN/2026/0178', planApprovalDate: '2026-04-25',
    planApprovalPurpose: 'Residential', affectedByStreetLines: 'No', affectedByBuildingLimits: 'No',
    distFromMainRoad: '30', distFromByRoad: '15', bankName: 'Test Bank', bankEmail: BANK_EMAIL,
  }

  await client.query(
    `INSERT INTO valuation_requests (name, phone, email, nic, message)
     VALUES ($1,$2,$3,$4,$5)`,
    ['Kasun Perera', '771234567', 'abcd6771563@gmail.com', APPLICANT_NIC,
      `Learning project ready through Generate Descriptions (${BATCH}).`],
  )

  const project = await client.query(
    `INSERT INTO projects (
       applicant_nic, property_type, details, status, property_number, street_name,
       village_town, property_city, district, province, latitude, longitude, bank_name, bank_email)
     VALUES (
       $1,$2,$3::jsonb,'Descriptions Generated',$4,$5,$6,$6,$7,$8,$9,$10,$11,$12)
     RETURNING project_id`,
    [APPLICANT_NIC, 'Residential Land', JSON.stringify(details), details.propertyNumber, details.streetName,
      details.villageTown, details.district, details.province, details.latitude, details.longitude,
      details.bankName, details.bankEmail],
  )
  const projectId = project.rows[0].project_id

  const valuationDetails = {
    seedBatch: BATCH, bankBranchCode: BANK_CODE, bankEmail: BANK_EMAIL, bankName: 'Test Bank',
    branchName: 'Boralesgamuwa', bankContactPerson: 'Nadeesha Fernando', bankRequestDate: '2026-05-15',
    valuationPurpose: 'Secured lending', valuationDate: '2026-08-16',
    propertyAddress: '45/B, Lake Road, Boralesgamuwa',
  }
  await client.query(
    `INSERT INTO valuations (
       valuation_id, project_id, applicant_nic, details, status, technical_officer_id,
       assigned_date, assigned_time, assignment_accepted)
     VALUES (1,$1,$2,$3::jsonb,'Assignment Accepted',$4,'2026-08-16','09:30',true)`,
    [projectId, APPLICANT_NIC, JSON.stringify(valuationDetails), TO_ID],
  )

  const inspection = {
    seedBatch: BATCH, accessRoute: 'From Boralesgamuwa junction proceed 1.2 km along Lake Road; the property is on the western side.',
    roadWidth: '20 ft', roadType: 'Tarred municipal road', roadFacing: 'Eastern boundary',
    distanceFromNearestCity: '1.2 km', rightOfWay: 'Confirmed from the public road',
    shapeOfLand: 'Regular rectangular shape', landPositionRelativeToRoad: 'Slightly above road level',
    frontage: '72 ft', floodProne: 'No evidence of flooding', boundariesMarked: 'Yes', soilType: 'Lateritic soil',
    drainage: 'Open municipal side drains', garbage: 'Municipal collection', gateType: 'Steel gate',
    unauthorizedStructures: 'None observed', northBoundary: details.boundaryNorth, eastBoundary: details.boundaryEast,
    southBoundary: details.boundarySouth, westBoundary: details.boundaryWest, boundariesMatch: 'Yes',
    localityName: 'Boralesgamuwa', nearestTown: 'Boralesgamuwa', distanceToNearestTown: '1.2 km',
    vicinityCharacter: 'Established middle-income residential neighbourhood',
    surroundingPropertyTypes: 'Detached houses and bare residential plots', developmentLevel: 'Highly developed',
    marketDemand: 'Good', highDemandPropertyTypes: 'Residential land', demandReason: 'Access to Colombo and local amenities',
    availableUtilities: 'Electricity, mains water, telephone and fibre internet',
    nearbyFacilities: 'Schools, supermarkets, banks, hospital and places of worship', facilitiesRadius: '2 km',
    transportFrequency: 'Frequent', transportRoad: 'Colombo-Horana Road', distanceToTransport: '1.2 km',
    dayToDayNeeds: 'Yes', dayToDayNeedsLocation: 'Boralesgamuwa town', inspectionDate: '2026-08-16',
    presentedParty: 'Kasun Maduranga Perera - Owner', technicalOfficer: 'Reshani Dilsara', signature: 'Reshani Dilsara',
  }
  await client.query(
    `INSERT INTO inspections (project_id,to_id,data,status)
     VALUES ($1,$2,$3::jsonb,'Completed')`,
    [projectId, TO_ID, JSON.stringify(inspection)],
  )
  await client.query(
    `INSERT INTO map_analyses
       (project_id,lat,lng,access_description,locality_description,access_sources,locality_sources)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
    [projectId, Number(details.latitude), Number(details.longitude), inspection.accessRoute,
      'Established residential locality in Boralesgamuwa with good access to Colombo.',
      JSON.stringify(['Field inspection']), JSON.stringify(['Field inspection'])],
  )

  const comparables = [
    { area: 'Boralesgamuwa', refNo: 'LEARN-C1', saleDate: '2026-06-20', extentPerches: 40, distanceKm: 0.6, pricePerPerch: 1850000, evidenceType: 'Nearby Comparable Land', propertyType: 'Residential Land', roadAccess: '20 ft tarred road', source: 'Market inquiry', note: 'Similar access and neighbourhood.' },
    { area: 'Piliyandala', refNo: 'LEARN-C2', saleDate: '2026-05-18', extentPerches: 60, distanceKm: 1.8, pricePerPerch: 1725000, evidenceType: 'Nearby Comparable Land', propertyType: 'Residential Land', roadAccess: 'Tarred road', source: 'Property agent', note: 'Inferior proximity to Colombo.' },
    { area: 'Pepiliyana', refNo: 'LEARN-C3', saleDate: '2026-07-02', extentPerches: 48, distanceKm: 1.4, pricePerPerch: 1950000, evidenceType: 'Nearby Comparable Land', propertyType: 'Residential Land', roadAccess: 'Main-road access', source: 'Owner inquiry', note: 'Superior road access.' },
  ]
  const ratePerPerch = 1850000
  const totalPerches = 52
  const marketValue = totalPerches * ratePerPerch
  const landAnalysis = {
    seedBatch: BATCH, comparables, ratePerPerch, marketTrend: 'Gradual increase', valuationDate: '2026-08-16',
    calculation: { totalPerches, ratePerPerch, landValue: marketValue, buildingValue: 0, marketValue, say: 96000000 },
    summary: { valuationDate: '2026-08-16', marketValue, forcedSaleValue: Math.round(marketValue * 0.8) },
    evidence: { comparables },
  }
  await client.query(
    `INSERT INTO land_analyses (project_id,data) VALUES ($1,$2::jsonb)`,
    [projectId, JSON.stringify(landAnalysis)],
  )

  const descriptions = {
    requestDescription: 'Test Bank, Boralesgamuwa Branch, requested by its letter dated 15th May 2026 an inspection and valuation of Lot 03 in Survey Plan No. SP-LEARN-001-2026 for secured lending purposes.',
    limitations: 'This valuation is prepared solely for secured lending purposes and is based on the documents supplied, conditions observable at inspection and the assumptions stated in the report.',
    generalAssumptions: 'The property is valued on the assumption of good and marketable title, free from undisclosed encumbrances, and with all statutory approvals valid and enforceable.',
    situation: 'The property known as Kahatagahawatta is situated at 45/B, Lake Road, Boralesgamuwa, within the administrative limits of the Boralesgamuwa Urban Council in Colombo District, Western Province.',
    extentDescription: 'The property comprises Lot 03 in Survey Plan No. SP-LEARN-001-2026 dated 12th April 2026, containing an extent of 0A-1R-12P, equivalent to approximately 0.1315 hectares. The plan and deed extents tally.',
    accessDescription: 'Access is obtained from Boralesgamuwa junction by proceeding approximately 1.2 km along Lake Road. The property fronts a 20-foot-wide tarred municipal road along its eastern boundary and enjoys confirmed direct public-road access.',
    landDescription: 'The subject is a regularly shaped rectangular residential allotment lying slightly above road level with approximately 72 feet of frontage. The soil is lateritic, boundaries are clearly identifiable and no flooding or unauthorized structures were observed.',
    ownershipDescription: 'According to Deed of Transfer No. DT-8841 dated 5th March 2026, the property is held in the name of Kasun Maduranga Perera. This statement is based on the documents supplied and does not constitute a legal opinion on title.',
    legalParagraph: 'Title particulars were reviewed with reference to Deed of Transfer No. DT-8841 and the supplied survey plan. The valuation remains subject to verification of title and statutory documentation by the relevant legal professionals.',
    localAuthorityTax: 'The property is identified under Assessment No. BUC/2026/4512 by the Boralesgamuwa Urban Council, according to the information supplied for this valuation.',
    streetLineBuildingLimits: 'According to the supplied local-authority information, the property is not affected by identified street lines or building limits, subject to verification against the original certificate.',
    mandatoryRequirements: 'Survey Plan No. SP-LEARN-001-2026 is recorded as approved by the Boralesgamuwa Urban Council under Reference BUC/PLAN/2026/0178 dated 25th April 2026 for residential purposes.',
    rentControlRegulation: 'No rent-control implications are considered applicable to this vacant residential land.',
    localityDescription: 'The immediate locality is a highly developed residential neighbourhood comprising detached houses and residential plots, with good market demand due to convenient access to Colombo and nearby services.',
    localityFacilities: 'Schools, supermarkets, banks, a hospital and places of worship are available within approximately 2 km. Electricity, mains water, telephone, fibre internet and frequent public transport are available.',
    certification: 'I certify that the property inspected corresponds to Lot 03 in Survey Plan No. SP-LEARN-001-2026 and that the opinion has been formed from the supplied documents, site inspection and available market evidence.',
    conclusion: 'Having considered the location, access, physical attributes, prevailing market conditions and comparable evidence under the Direct Comparison Method, the current market value is concluded at Rs. 96,000,000 /-.',
    valuation: JSON.stringify({ extentText: '0A - 1R - 12P', totalPerches, ratePerPerch, landValue: marketValue, buildingValue: 0, marketValue, say: 96000000, notes: ['The plan and deed extents tally.', 'The adopted rate reflects the comparable evidence and property-specific adjustments.'] }),
    evidence: JSON.stringify({ comparables, rangeLow: 1725000, rangeHigh: 1950000, hasAnalysis: true }),
    imageAnalysis: 'No site photographs were seeded for this learning project; photographs can be added before the draft is finalized.',
    seedBatch: BATCH,
  }
  await client.query(
    `INSERT INTO descriptions (project_id,data) VALUES ($1,$2::jsonb)`,
    [projectId, JSON.stringify(descriptions)],
  )

  await client.query('COMMIT')
  console.log(JSON.stringify({ existing: false, projectId, valuationId: 1, technicalOfficerId: TO_ID, stoppedAt: 'Descriptions saved', draftCreated: false }, null, 2))
} catch (error) {
  await client.query('ROLLBACK')
  console.error(error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
