// Single source of truth for the Create Project form fields that are stored as
// their OWN column in the `projects` table (uploaded files go to project_files).
//
// Each key matches the form field name (camelCase); the database column is the
// snake_case version. Keep this list in sync with the frontend projectFields.ts.

// camelCase -> snake_case. Also splits letter/number boundaries, so
// planOlderThan10 -> plan_older_than_10.
const toSnake = (s: string) =>
  s
    .replace(/([a-z])([A-Z0-9])/g, '$1_$2')
    .replace(/([0-9])([a-zA-Z])/g, '$1_$2')
    .toLowerCase()

// Every detail field, in the same order the form shows them.
export const projectFieldKeys = [
  // Section 5 — Property Address (+ map coordinates)
  'propertyNumber', 'streetName', 'villageTown', 'propertyCity', 'gnDivision', 'dsDivision',
  'district', 'province', 'postalCode', 'latitude', 'longitude',
  // Section 6 — Situation / Administrative
  'landTraditionalName', 'localAuthorityType', 'localAuthorityName', 'pattu',
  'korale', 'propertyType',
  // Section 7 — Survey Plan
  'surveyPlanNumber', 'surveyPlanDate', 'surveyorName', 'surveyorLicenseNo',
  'lotNumber', 'planOlderThan10', 'planActionIfOld',
  // Section 8 — Land Extent
  'extentAcres', 'extentRoods', 'extentPerches', 'extentHectares',
  'deedExtentAcres', 'deedExtentRoods', 'deedExtentPerches', 'deedExtentHectares',
  'extentAsPerPlan', 'extentAsPerDeed', 'extentsTally',
  // Section 9 — Deed / Ownership
  'deedType', 'deedNumber', 'deedDate', 'bankRequestDate', 'attorneyName', 'notaryNoLocation',
  'ownerNameAsPerDeed', 'ownershipType', 'landRegistrySearchDone', 'previousOwnerName',
  // Section 10 — Boundaries
  'boundaryNorth', 'boundaryEast', 'boundarySouth', 'boundaryWest',
  'rightOfWayAvailable', 'rightOfWayFrom',
  // Section 11 — Legal & Local Authority
  'assessmentNumber', 'assessmentLetterDate', 'assessmentAuthority',
  'streetLineCertDate', 'affectedByStreetLines', 'affectedByBuildingLimits',
  'distFromMainRoad', 'distFromByRoad',
  // Section 12 — Planning Regulations
  'planApprovedByLA', 'planApprovalRef', 'planApprovalDate', 'planApprovalPurpose',
  'buildingPlanApprovalNo', 'buildingPlanApprovalDate', 'cocProvided',
  'planningAuthority', 'rentControlAffected', 'maxPlotCoverage',
  'plotCoverageProperty',
  // Requesting bank (used for the project-created notification)
  'bankName', 'bankEmail',
] as const

// { key, column } pairs used to build the INSERT and the startup auto-migration.
export const projectFieldColumns = projectFieldKeys.map((key) => ({
  key,
  column: toSnake(key),
}))
