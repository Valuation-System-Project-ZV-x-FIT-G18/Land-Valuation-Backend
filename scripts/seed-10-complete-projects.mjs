import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import pg from 'pg'

const { Client } = pg
const root = process.cwd()
const envPath = path.join(root, '.env')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
)

const BATCH = 'codex-10x3-20260815'
const APPLICANT_NIC = '222222222222'
const BANK_CODE = '000614'
const BANK_EMAIL = 'pranidimethmini@gmail.com'
const TO_ID = 'TO001'

const locations = [
  ['125/A', 'Pannipitiya', '6.8464000', '79.9483000'],
  ['127/B', 'Pannipitiya', '6.8481000', '79.9502000'],
  ['131/C', 'Kottawa', '6.8412000', '79.9654000'],
  ['142/A', 'Maharagama', '6.8495000', '79.9269000'],
  ['156/D', 'Thalawathugoda', '6.8759000', '79.9352000'],
  ['161/B', 'Pelawatta', '6.8906000', '79.9275000'],
  ['174/A', 'Homagama', '6.8414000', '80.0030000'],
  ['188/C', 'Malabe', '6.9063000', '79.9553000'],
  ['203/A', 'Battaramulla', '6.9006000', '79.9181000'],
  ['218/B', 'Nugegoda', '6.8649000', '79.8997000'],
]

const client = new Client({ connectionString: env.DATABASE_URL })
await client.connect()

try {
  await client.query('BEGIN')

  const required = await client.query(
    `SELECT user_id, role FROM users WHERE user_id = ANY($1::text[])`,
    [[APPLICANT_NIC, BANK_CODE, TO_ID]],
  )
  if (required.rowCount !== 3) throw new Error('Required applicant, bank, or technical-officer account is missing.')

  const existing = await client.query(
    `SELECT project_id FROM projects WHERE details->>'seedBatch' = $1 ORDER BY project_id`,
    [BATCH],
  )
  if (existing.rowCount) {
    throw new Error(`Seed batch ${BATCH} already exists with ${existing.rowCount} projects; no records were changed.`)
  }

  const created = []
  for (let i = 0; i < locations.length; i += 1) {
    const n = i + 1
    const [propertyNumber, town, lat, lng] = locations[i]
    const planNo = `SP-CX-${String(n).padStart(3, '0')}-2026`
    const deedNo = `CX${String(6100 + n)}`
    const assessmentNo = `TEST/${town.toUpperCase().replace(/\s+/g, '-')}/${propertyNumber}`
    const perches = 40 + n * 2
    const rate = 1_150_000 + n * 25_000
    const marketValue = perches * rate
    const details = {
      seedBatch: BATCH, seedProjectNumber: n, propertyType: 'Residential Land',
      propertyNumber, streetName: 'High Level Road', villageTown: town,
      propertyCity: town, gnDivision: `${town} North`, dsDivision: town === 'Pannipitiya' ? 'Maharagama' : town,
      province: 'Western Province', district: 'Colombo', postalCode: '10230', latitude: lat, longitude: lng,
      landTraditionalName: `Delgahawatta Test Lot ${n}`, localAuthorityType: 'Municipal Council',
      localAuthorityName: 'Relevant Local Authority', pattu: 'Palle Pattu', korale: 'Salpiti Korale',
      surveyPlanNumber: planNo, surveyPlanDate: '2026-01-15', surveyorName: 'Saman Jayawardena',
      surveyorLicenseNo: 'LS-2458', lotNumber: `Lot ${String(n).padStart(2, '0')}`, planOlderThan10: 'No',
      extentAcres: '0', extentRoods: '1', extentPerches: String(perches - 40),
      extentHectares: (perches * 0.002529285).toFixed(4), extentAsPerPlan: `${perches} perches`,
      extentAsPerDeed: `${perches} perches`, extentsTally: 'Yes', deedType: 'Deed of Transfer',
      ownershipType: 'Sole Ownership', deedNumber: deedNo, deedDate: '2026-02-20',
      attorneyName: 'Nimal Perera', notaryNoLocation: 'N.P. 1245, Colombo',
      ownerNameAsPerDeed: 'Kasun Maduranga Perera', previousOwnerName: 'Sunil Perera',
      boundaryNorth: 'Adjoining residential property', boundaryEast: 'High Level Road / access road',
      boundarySouth: 'Adjoining residential property', boundaryWest: 'Private access road',
      rightOfWayAvailable: 'Yes', assessmentNumber: assessmentNo,
      planApprovedByLa: 'Yes', planApprovalRef: `LA/TEST/2026/${String(n).padStart(4, '0')}`,
      planApprovalDate: '2026-03-10', planApprovalPurpose: 'Residential',
      bankName: 'Test Bank', bankEmail: BANK_EMAIL,
    }

    await client.query(
      `INSERT INTO valuation_requests (name, phone, email, nic, message, created_at)
       VALUES ($1,$2,$3,$4,$5, now() - ($6 || ' days')::interval)`,
      ['Kasun Perera', '771234567', 'abcd6771563@gmail.com', APPLICANT_NIC,
       `Seeded valuation request ${n} for ${propertyNumber}, ${town} (${BATCH}).`, 50 - n],
    )

    const project = await client.query(
      `INSERT INTO projects (
         applicant_nic, property_type, details, status, property_number, street_name, village_town,
         property_city, gn_division, ds_division, district, province, postal_code, latitude, longitude,
         land_traditional_name, local_authority_type, local_authority_name, pattu, korale,
         survey_plan_number, survey_plan_date, surveyor_name, surveyor_license_no, lot_number,
         plan_older_than_10, extent_acres, extent_roods, extent_perches, extent_hectares,
         deed_extent_acres, deed_extent_roods, deed_extent_perches, deed_extent_hectares,
         extent_as_per_plan, extent_as_per_deed, extents_tally, deed_type, ownership_type,
         deed_number, deed_date, attorney_name, notary_no_location, owner_name_as_per_deed,
         previous_owner_name, boundary_north, boundary_east, boundary_south, boundary_west,
         right_of_way_available, assessment_number, plan_approved_by_la, plan_approval_ref,
         plan_approval_date, plan_approval_purpose, bank_name, bank_email, created_at)
       VALUES (
         $1,$2,$3::jsonb,'Completed',$4,'High Level Road',$5,$5,$6,$7,'Colombo','Western Province','10230',$8,$9,
         $10,'Municipal Council','Relevant Local Authority','Palle Pattu','Salpiti Korale',$11,'2026-01-15',
         'Saman Jayawardena','LS-2458',$12,'No','0','1',$13,$14,'0','1',$13,$14,$15,$15,'Yes',
         'Deed of Transfer','Sole Ownership',$16,'2026-02-20','Nimal Perera','N.P. 1245, Colombo',
         'Kasun Maduranga Perera','Sunil Perera','Adjoining residential property','High Level Road / access road',
         'Adjoining residential property','Private access road','Yes',$17,'Yes',$18,'2026-03-10','Residential',
         'Test Bank',$19, now() - ($20 || ' days')::interval)
       RETURNING project_id`,
      [APPLICANT_NIC, 'Residential Land', JSON.stringify(details), propertyNumber, town, `${town} North`,
       town === 'Pannipitiya' ? 'Maharagama' : town, lat, lng, `Delgahawatta Test Lot ${n}`, planNo,
       `Lot ${String(n).padStart(2, '0')}`, String(perches - 40), (perches * 0.002529285).toFixed(4),
       `${perches} perches`, deedNo, assessmentNo, `LA/TEST/2026/${String(n).padStart(4, '0')}`, BANK_EMAIL, 45 - n],
    )
    const projectId = project.rows[0].project_id

    for (let valuationNo = 1; valuationNo <= 3; valuationNo += 1) {
      const valuationDate = `2026-0${3 + valuationNo}-${String(10 + n).padStart(2, '0')}`
      const valuationRate = rate + (valuationNo - 2) * 35_000
      await client.query(
        `INSERT INTO valuations (
           valuation_id, project_id, applicant_nic, details, status, technical_officer_id,
           assigned_date, assigned_time, assignment_accepted, created_at)
         VALUES ($1,$2,$3,$4::jsonb,'Completed',$5,$6,'09:30',true, now() - ($7 || ' days')::interval)`,
        [valuationNo, projectId, APPLICANT_NIC, JSON.stringify({
          seedBatch: BATCH, bankBranchCode: BANK_CODE, bankEmail: BANK_EMAIL,
          bankName: 'Test Bank', purpose: valuationNo === 1 ? 'Initial valuation' : `Revaluation ${valuationNo}`,
          valuationDate, propertyAddress: `${propertyNumber}, High Level Road, ${town}`,
        }), TO_ID, valuationDate, 35 - (n + valuationNo)],
      )
      await client.query(
        `INSERT INTO land_value_calculations (project_id, valuation_id, data)
         VALUES ($1,$2,$3::jsonb)`,
        [projectId, valuationNo, JSON.stringify({
          seedBatch: BATCH, valuationDate, extentPerches: perches, ratePerPerch: valuationRate,
          marketValue: perches * valuationRate, forcedSalePercentage: 80,
          forcedSaleValue: Math.round(perches * valuationRate * 0.8), currency: 'LKR', status: 'Final',
        })],
      )
    }

    const inspection = {
      accessRouteDescription: `From ${town} town, proceed along High Level Road to ${propertyNumber}.`,
      accessRoadWidth: '20 ft', roadType: 'Tarred Road', roadFacingDirection: 'Road on the eastern boundary',
      distanceFromNearestCity: '3.5 km', rightOfWayConfirmation: 'Yes - legal right of way confirmed.',
      shapeOfLand: 'Nearly rectangular', landPositionRelativeToRoad: 'Slightly above road level',
      frontageMeasurement: '65 ft', floodProneStatus: 'No apparent flooding observed.', soilType: 'Lateritic soil',
      northBoundary: 'Adjoining residential property', eastBoundary: 'High Level Road / access road',
      southBoundary: 'Adjoining residential property', westBoundary: 'Private access road',
      physicalBoundariesMatchSurveyPlan: 'Yes, subject to licensed survey verification.',
      locality: town, nearestMainTown: town, localityCharacter: 'Residential', developmentLevel: 'Highly Developed',
      marketDemand: 'High', utilities: 'Electricity, mains water, mobile coverage and internet services.',
      publicTransport: 'Frequent', inspectionDate: '2026-08-15', partyPresent: 'Kasun Maduranga Perera - Owner',
      technicalOfficer: 'Reshani Dilsara', signature: 'Reshani Dilsara', seedBatch: BATCH,
    }
    await client.query(
      `INSERT INTO inspections (project_id,to_id,data,status,created_at)
       VALUES ($1,$2,$3::jsonb,'Completed',now())`,
      [projectId, TO_ID, JSON.stringify(inspection)],
    )
    await client.query(
      `INSERT INTO map_analyses (project_id,lat,lng,access_description,locality_description,access_sources,locality_sources)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [projectId, Number(lat), Number(lng), inspection.accessRouteDescription,
       `Established residential locality in ${town}, Western Province.`, JSON.stringify(['Field inspection']), JSON.stringify(['Field inspection'])],
    )
    const comparables = [
      { area: town, refNo: `${projectId}-C1`, saleDate: '2026-06-18', extentPerches: 40, distanceKm: 0.8, pricePerPerch: rate, evidenceType: 'Nearby Comparable Land', propertyType: 'Bare / Residential Land', roadAccess: 'Tarred road', source: 'Field / Market Enquiry', note: 'Same locality and similar access.' },
      { area: 'Maharagama', refNo: `${projectId}-C2`, saleDate: '2026-05-22', extentPerches: 60, distanceKm: 1.6, pricePerPerch: rate + 150000, evidenceType: 'Nearby Comparable Land', propertyType: 'Bare / Residential Land', roadAccess: 'Main road', source: 'Local Property Agent Enquiry', note: 'Superior town access; downward adjustment applied.' },
      { area: 'Kottawa', refNo: `${projectId}-C3`, saleDate: '2026-04-10', extentPerches: 48, distanceKm: 1.9, pricePerPerch: rate - 100000, evidenceType: 'Nearby Comparable Land', propertyType: 'Bare / Residential Land', roadAccess: 'Tarred road', source: 'Owner and Market Enquiry', note: 'Broadly similar residential evidence.' },
    ]
    await client.query(
      `INSERT INTO land_analyses (project_id,data) VALUES ($1,$2::jsonb)`,
      [projectId, JSON.stringify({ seedBatch: BATCH, comparables, ratePerPerch: rate, marketTrend: 'going up steadily', valuationDate: '2026-08-15' })],
    )
    await client.query(
      `INSERT INTO descriptions (project_id,data) VALUES ($1,$2::jsonb)`,
      [projectId, JSON.stringify({ seedBatch: BATCH, property: `${propertyNumber}, High Level Road, ${town}`,
        access: inspection.accessRouteDescription, land: inspection.shapeOfLand,
        locality: `Established residential locality in ${town}.`, legal: 'Title and survey references reviewed for test workflow.',
      })],
    )
    await client.query(
      `INSERT INTO drafts (project_id,data,review_status,reject_reason,paid,paid_at,payment_ref,payment_method,slip_pending,report_price,created_at)
       VALUES ($1,$2::jsonb,'locked','',true,now(),$3,'bank_slip',false,25000,now())`,
      [projectId, JSON.stringify({ seedBatch: BATCH, status: 'Final', valuationDate: '2026-08-15',
        ownerName: 'Kasun Maduranga Perera', propertyAddress: `${propertyNumber}, High Level Road, ${town}`,
        extentPerches: perches, adoptedRatePerPerch: rate, marketValue, reviewTrail: [
          { level: 'L3', decision: 'Approved' }, { level: 'L2', decision: 'Approved' }, { level: 'L1', decision: 'Locked' },
        ],
      }), `PAY-${BATCH}-${String(n).padStart(2, '0')}`],
    )
    await client.query(
      `INSERT INTO applicant_documents (applicant_nic,project_id,doc_type,file_name,file_path,status,file_mime,size,object_key)
       VALUES ($1,$2,'surveyPlan',$3,'','Approved','application/pdf',0,''),
              ($1,$2,'titleDeed',$4,'','Approved','application/pdf',0,'')`,
      [APPLICANT_NIC, projectId, `${planNo}.pdf`, `Deed-${deedNo}.pdf`],
    )
    created.push({ projectId, valuations: 3, town, marketValue })
  }

  await client.query('COMMIT')
  console.log(JSON.stringify({ batch: BATCH, projects: created.length, valuations: created.length * 3, created }, null, 2))
} catch (error) {
  await client.query('ROLLBACK')
  console.error(error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
