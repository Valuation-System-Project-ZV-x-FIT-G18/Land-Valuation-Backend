// Flat list of inspection form fields (key + the label EXACTLY as printed on the
// form). Used to anchor/parse OCR text. Must match the frontend inspectionFields
// labels and the printed blank form, or parsing breaks.
export const inspectionFields: { key: string; label: string; options?: string[]; type?: 'date' }[] = [
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
  { key: 'localityName', label: 'Village, town or locality' },
  { key: 'nearestTown', label: 'Nearest main town / town centre' },
  { key: 'distanceToNearestTown', label: 'Distance from the nearest main town' },
  { key: 'vicinityCharacter', label: 'Main character of the surrounding locality', options: ['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Mixed Development', 'Rural'] },
  { key: 'surroundingPropertyTypes', label: 'Properties mostly found in the immediate vicinity' },
  { key: 'developmentLevel', label: 'Development level of the immediate vicinity', options: ['Fully Developed', 'Moderately Developed', 'Developing', 'Undeveloped'] },
  { key: 'marketDemand', label: 'Current property market demand', options: ['High', 'Moderate', 'Low'] },
  { key: 'highDemandPropertyTypes', label: 'Property types with the highest demand' },
  { key: 'demandReason', label: 'Main reasons for the demand' },
  { key: 'availableUtilities', label: 'Available utility services' },
  { key: 'nearbyFacilities', label: 'Important facilities available near the property' },
  { key: 'facilitiesRadius', label: 'Approximate radius in which facilities are available' },
  { key: 'transportFrequency', label: 'Public transport availability and frequency', options: ['Frequent', 'Regular', 'Limited', 'Not Available'] },
  { key: 'transportRoad', label: 'Road along which public transport operates' },
  { key: 'distanceToTransport', label: 'Distance to nearest bus route / transport point' },
  { key: 'dayToDayNeeds', label: 'Can daily necessities be obtained nearby?', options: ['Yes', 'Partially', 'No'] },
  { key: 'dayToDayNeedsLocation', label: 'Where can residents obtain daily necessities?', options: ['Within the Same Village', 'Nearest Junction', 'Nearest Town', 'Weekly Market / Travelling Vendors'] },
  // Inspection Details
  { key: 'inspectionDate', label: 'Date of inspection', type: 'date' },
  { key: 'presentedParty', label: 'Party present at the inspection' },
  { key: 'technicalOfficer', label: 'Technical Officer' },
  { key: 'signature', label: 'Signature' },
]
