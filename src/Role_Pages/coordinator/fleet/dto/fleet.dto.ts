import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class AssignFleetDto {
  @IsString() @MinLength(1) @MaxLength(20) valuationRowId: string
  @IsString() @MinLength(1) @MaxLength(20) toId: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD.' }) date: string
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be HH:MM.' }) time: string
}

export class AcceptRejectionDto {
  @IsString() @MinLength(1) @MaxLength(20) valuationRowId: string
}

export class RejectAssignmentDto {
  @IsString() @MinLength(1) @MaxLength(20) valuationRowId: string
  @IsString() @MinLength(1) @MaxLength(20) toId: string
  @IsString() @MinLength(1) @MaxLength(500) reason: string
}

export class MarkLeaveDto {
  @IsString() @MinLength(1) @MaxLength(20) toId: string
  @IsOptional() @IsString() @MaxLength(500) reason?: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD.' }) date: string
}

export class RemoveLeaveDto {
  @IsString() @MinLength(1) @MaxLength(20) id: string
}
