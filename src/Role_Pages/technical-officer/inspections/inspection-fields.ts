// Flat list of inspection form fields (key + the label EXACTLY as printed on the
// form). Used to anchor/parse OCR text. Must match the frontend inspectionFields
// labels and the printed blank form, or parsing breaks.
export const inspectionFields: { key: string; label: string }[] = [
  // 1. Access & Location
  { key: 'accessRoute', label: 'Access route description from nearest town' },
  { key: 'roadWidth', label: 'Access road width' },
  { key: 'roadType', label: 'Road type (Tarred / Gravel / Other)' },
  { key: 'roadFacing', label: 'Road facing direction / Boundary facing road' },
  { key: 'distanceFromNearestCity', label: 'Distance from nearest city' },
  { key: 'rightOfWay', label: 'Right of way confirmation' },
  // 2. Description of the Land
  { key: 'landShape', label: 'Shape of land' },
  { key: 'landPosition', label: 'Land position relative to road' },
  { key: 'frontage', label: 'Frontage measurement (ft)' },
  { key: 'floodProne', label: 'Flood prone status' },
  { key: 'boundariesMarked', label: 'Boundaries clearly marked on ground' },
  { key: 'soilType', label: 'Soil type' },
  { key: 'drainage', label: 'Rainwater drainage method' },
  { key: 'garbage', label: 'Garbage disposal method' },
  { key: 'gateType', label: 'Gate / Entry type' },
  { key: 'unauthorizedStructures', label: 'Unauthorized structures on land' },
  // 3. Boundary Verification
  { key: 'northBoundary', label: 'North Boundary' },
  { key: 'eastBoundary', label: 'East Boundary' },
  { key: 'southBoundary', label: 'South Boundary' },
  { key: 'westBoundary', label: 'West Boundary' },
  { key: 'boundariesMatchPlan', label: 'Physical boundaries match survey plan' },
  // 4. Locality Description
  { key: 'vicinityCharacter', label: 'Character of immediate vicinity' },
  { key: 'nearbyFacilities', label: 'Nearby facilities' },
  { key: 'transportFrequency', label: 'Transport frequency' },
  { key: 'dayToDayNeeds', label: 'Availability of day-to-day needs' },
  // Inspection Details
  { key: 'inspectionDate', label: 'Date of inspection' },
  { key: 'presentedParty', label: 'Party present at the inspection' },
  { key: 'technicalOfficer', label: 'Technical Officer' },
  { key: 'signature', label: 'Signature' },
]
