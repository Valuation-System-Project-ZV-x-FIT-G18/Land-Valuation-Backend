// The valuation-report template. The `#N` tokens mirror the tokens in the
// officer's template document; fill() replaces each one with project data.

export const REPORT_TEMPLATE = `REF - #1

                              VALUATION REPORT

                                    #2
                                   (#3)

                                    #4
                                    #5
                                    #6
                                    #7

                                    Vlr. H.M.R.R. Narampanawa
                                    Chartered Valuation Surveyor
                                    RICS Registered No. 6698015 (FRICS)
                                    IVSL – F/315

Ref/#1/2025                                   Confidential            #16

The Manager,
#8,
#9

Dear Sir,

VALUATION REPORT OF PROPERTY DEPICTED AS LOT NO. #10 IN SURVEY PLAN NO. #11 DATED #12 MADE BY #13 LICENSED SURVEYOR

The Manager of #14 - #15 has requested by his letter dated #16 to inspect the property depicted as Lot No. #17 in Survey Plan No. #18 dated #19 made by #20 Licensed Surveyor, situated at #21 within the administrative limits of #22 Urban Council and furnish a valuation report for the estimation of both market value and forced sale value for the purpose of secured lending.

The valuation details are as follows;

  Land Only
  Market Value as at #41            ; - Rs. #24 /-
  Forced Sale value as at #41       ; - Rs. #25 /-

Further details are included in the report. Please refer the annexure 01 mentioned below.

LIMITATIONS
 • This valuation is valid only for the estimate of market value and forced sale value for the purpose of mortgage and should not be used for any other purpose or in any manner other than as stated herein.
 • I am not liable for any damages incurred by the client of the report if it is used for a purpose other than the "Intended Purpose" of the report.
 • This valuation has been prepared for the Directors of #26 and is not intended for any other person. No responsibility is accepted to third parties for the whole or any part of the contents.
 • The valuation relies on the available information at the time of inspection. I am not responsible for any facts not covered during the inspection.
 • The valuation is based on the provided legal document by the client. The valuer is not responsible for any negligence done by the professionals (Surveyor).
 • The analysis and conclusions are limited by the assumptions and conditions reported.

GENERAL ASSUMPTIONS
 • I have valued the property based on the assumption that the owner holds an unencumbered freehold interest in the property.
 • The property has been valued as if wholly owned, with no account taken of any outstanding debts, including mortgage bonds, loans, or other charges.

COMPLIANCE STATEMENT
 • The valuer has no conflicts of interest with respect to the subject property.
 • The valuation has been prepared in accordance with the Sri Lanka Valuation Standards (IVSL), the guidance of RICS and the standards of IVSC.
 • The valuation has been conducted by the valuer to the best of their knowledge, based on an analysis of market evidence.

VALUATION REPORT OF PROPERTY DEPICTED AS LOT NO. #27 IN SURVEY PLAN NO. #28 DATED #29 MADE BY #30 LICENSED SURVEYOR

1. PURPOSE OF THE VALUATION
The purpose of this valuation is to determine both the market value and forced sale value of the subject property for secured lending purpose.

2. PREMISE OF VALUE
This valuation report considers the existing use of the property as the premise of value, in accordance with the specific requirements for secured lending purpose.

3. BASIS OF THE VALUATION
The basis of this valuation is market value, forced sale value and insurance value.

4. CLIENT INFORMATION
4.1 Name and address of the Mortgagor  : #31
                                         #32
                                         #33
                                         #34
                                         #35
4.2 Contact Numbers                    : #36
4.3 Type of the property               : #37
4.4 Address of the property            : #38
4.5 Party present at the inspection    : #39
4.6 Date of inspection                 : #40
4.7 Date of valuation                  : #41

5. PROPERTY DETAILS
5.1 SITUATION
#42

5.2 DESCRIPTION OF THE PROPERTY
5.2.1 EXTENT
Survey Plan : Lot No. #43 in Survey Plan No. #44 dated #45 made by #46 Licensed Surveyor.
   Extent  : #51 A - #52 R - #53 P   (Hectares: #54)
Deed        : #205 No. #47 dated #48 attested by #49 Attorney at Law & #50
   Extent  : #55 A - #56 R - #57 P   (Hectares: #58)
#206

5.2.2 VALIDITY OF THE SURVEY PLAN
Date of Survey Plan : #59    Exceeding over 10 years : #60    Endorsement / new survey plan : #61

5.2.3 BOUNDARIES
                 On Plan                         On Site
North by     :   #62                             #66
East by      :   #63                             #67
South by     :   #64                             #68
West by      :   #65                             #69
The main access to the property is from its #70 boundary.

5.2.4 SURVEY PLAN
#71

5.3 ACCESS AND NATURE OF THE ACCESSIBILITY
#73
Coordinate of the Location : #74     Location : #75
#72
#76

5.4 DESCRIPTION OF THE LAND
#77

5.5 DETAIL DESCRIPTION OF THE LAND
Access road photo            : #79
Route from main road photo   : #80
Front view of the land       : #81
Rear view of the land        : #82
Left side view of land       : #83
Right side view of the land  : #84
East Boundary of the land    : #85
South Boundary of the land   : #86
West Boundary of the land    : #87
North Boundary of the land   : #88
Additional photographs       : #89

6. LEGAL & PLANNING CLEARANCE
6.1 LEGAL ASPECT
6.1.1 OWNERSHIP
#90
6.1.2 LOCAL AUTHORITY TAX
#91
6.1.3 STREET LINE & BUILDING LIMITS
#92

6.2 PLANNING REGULATIONS
6.2.1 MANDATORY REQUIREMENTS
#188

7. LOCALITY
#189

8. APPROACH AND METHOD TO THE VALUATION
#207

9. EVIDENCE OF LAND VALUES & RENTALS
9.1 RICS EVIDENCE HIERARCHY
#190

10.0 BASE OF VALUATION & RATIONAL
 1. My valuation has been undertaken using appropriate valuation methodology and my professional judgment.
 2. I have undertaken to provide an assessment of the market value of the property on 'as is' basis, including all improvements as they stand.
 3. I have #191 this property previously.

11.0 VALUATION
#192

12. CONCLUSION
#193

13. SUMMARY
The valuation details are as follows.
Land Only
Market Value as at #194            ; - Rs. #196 /- (#195)
Forced Sale value as at #197       ; - Rs. #199 /- (#198)

14. CERTIFICATION
I certify that the property inspected and valued by me corresponds precisely to Lot No. #200 in Survey Plan No. #201 dated #202 made by #203 Licensed Surveyor. The property's boundaries were verified on-site and confirmed to align with the boundaries indicated in the aforementioned plan. I recommend that the above estimated values are fair and reasonable.

Vlr. H.M.R.R. Narampanawa (FRICS)
RICS Registered Chartered Valuation Surveyor
Panel Valuer of #204
`

// Placeholder number -> the field key produced by DraftService.buildValues().
export const NUM_TO_KEY: Record<number, string> = {
  1: 'projectId', 2: 'landName', 3: 'ownerName', 4: 'addressLine1', 5: 'addressLine2', 6: 'ownerCity', 7: 'district',
  8: 'bankName', 9: 'branchName', 10: 'lotNo', 11: 'surveyPlanNo', 12: 'surveyDate', 13: 'surveyorName',
  14: 'bankName', 15: 'branchName', 16: 'valuationRequestDate', 17: 'lotNo', 18: 'surveyPlanNo', 19: 'surveyDate',
  20: 'surveyorName', 21: 'propertyLocationCity', 22: 'urbanCouncil', 23: 'marketValue', 24: 'marketValue',
  25: 'forcedSaleValue', 26: 'bankName', 27: 'lotNo', 28: 'surveyPlanNo', 29: 'surveyDate', 30: 'surveyorName',
  31: 'landName', 32: 'ownerName', 33: 'addressLine1', 34: 'addressLine2', 35: 'ownerCity', 36: 'contactNo',
  37: 'propertyType', 38: 'propertyAddress', 39: 'presentedParty', 40: 'inspectionDate', 41: 'valuationDate',
  42: 'localityDescription', 43: 'lotNo', 44: 'surveyPlanNo', 45: 'surveyDate', 46: 'surveyorName', 47: 'deedNo',
  48: 'deedDate', 49: 'attorney', 50: 'notary', 51: 'extentAcres', 52: 'extentRoods', 53: 'extentPerches',
  54: 'extentHectares', 55: 'deedAcres', 56: 'deedRoods', 57: 'deedPerches', 58: 'deedHectares', 59: 'surveyDate',
  60: 'planOver10Years', 61: 'surveyPlanRequiredAction', 62: 'boundaryNorth', 63: 'boundaryEast', 64: 'boundarySouth',
  65: 'boundaryWest', 66: 'siteBoundaryNorth', 67: 'siteBoundaryEast', 68: 'siteBoundarySouth', 69: 'siteBoundaryWest',
  70: 'accessFromBoundary', 73: 'accessLocationDescription', 74: 'gpsCoordinates', 75: 'propertyLocationCity',
  77: 'landDescription', 79: 'photoAccessRoad', 80: 'photoRouteFromMainRoad', 81: 'photoFrontView',
  82: 'photoRearView', 83: 'photoLeftSide', 84: 'photoRightSide', 85: 'photoEastBoundary', 86: 'photoSouthBoundary',
  87: 'photoWestBoundary', 88: 'photoNorthBoundary', 90: 'legalDescription', 91: 'localAuthorityTax',
  92: 'streetLineBuildingLimits', 188: 'mandatoryRequirements', 189: 'localityFacilities', 190: 'nearbyPropertyDetails',
  191: 'previouslyValued', 192: 'valuationText', 193: 'conclusion', 194: 'valuationDate', 195: 'marketValueWords',
  196: 'marketValue', 197: 'valuationDate', 198: 'forcedSaleValueWords', 199: 'forcedSaleValue', 200: 'lotNo',
  201: 'surveyPlanNo', 202: 'surveyDate', 203: 'surveyorName', 204: 'bankName', 205: 'deedType',
  206: 'extentVerificationStatement', 207: 'valuationApproachStatement',
}

// Image placeholders — replaced with a labelled marker in the text draft.
export const IMAGE_MARKERS: Record<number, string> = {
  71: '{surveyPlanImage}',
  72: '{satelliteLocationImage}',
  76: '{locationMapImage}',
  78: '{photoFrontView}',
  79: '{photoAccessRoad}',
  80: '{photoRouteFromMainRoad}',
  81: '{photoFrontView}',
  82: '{photoRearView}',
  83: '{photoLeftSide}',
  84: '{photoRightSide}',
  85: '{photoEastBoundary}',
  86: '{photoSouthBoundary}',
  87: '{photoWestBoundary}',
  88: '{photoNorthBoundary}',
  89: '{additionalLandPhotographs}',
}
