import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class SaveValuerProfileDto {
  @IsString() @MinLength(1) @MaxLength(20) userId: string
  @IsString() @MinLength(2) @MaxLength(150) valuerName: string
  @IsIn(['No Conflict', 'Conflict Disclosed']) conflictOfInterest: string
  @IsOptional() @IsString() @MaxLength(1000) conflictDetails?: string
  @IsString() @MaxLength(500) professionalQualifications: string
  @IsString() @MinLength(1) @MaxLength(50) ivslRegistrationNumber: string
  @IsOptional() @IsString() @MaxLength(50) ricsRegistrationNumber?: string
  @IsIn(['Confirmed', 'Not Confirmed']) relevantExperience: string
  @IsIn(['Active', 'Expired', 'Not Available']) indemnityStatus: string
  @IsOptional() @IsString() @MaxLength(100) indemnityPolicyNumber?: string
  @IsOptional() @IsString() @MaxLength(10) indemnityExpiryDate?: string
}
