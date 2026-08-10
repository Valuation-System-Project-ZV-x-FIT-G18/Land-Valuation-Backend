import { IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { Transform } from 'class-transformer'

// Row ids (valuationRowId, id) come back from other endpoints as numbers
// (e.g. fleet.service.ts's `rowId: Number(v.id)`), so coerce to a string
// before validating instead of rejecting the number outright.
const idTransform = Transform(({ value }) => String(value))

export class AssignFleetDto {
  @idTransform @IsString() @MinLength(1) @MaxLength(20) valuationRowId: string
  @IsString() @MinLength(1) @MaxLength(20) toId: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD.' }) date: string
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be HH:MM.' }) time: string
}

export class AcceptRejectionDto {
  @idTransform @IsString() @MinLength(1) @MaxLength(20) valuationRowId: string
}

export class RejectAssignmentDto {
  @idTransform @IsString() @MinLength(1) @MaxLength(20) valuationRowId: string
  @IsString() @MinLength(1) @MaxLength(20) toId: string
  @IsString() @MinLength(1) @MaxLength(500) reason: string
}

export class AssignmentActionDto {
  @idTransform @IsString() @MinLength(1) @MaxLength(20) valuationRowId: string
  @IsString() @MinLength(1) @MaxLength(20) toId: string
}

export class MarkLeaveDto {
  @IsString() @MinLength(1) @MaxLength(20) toId: string
  @IsString() @MinLength(1, { message: 'Please enter a reason for leave.' }) @MaxLength(500) reason: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD.' }) date: string
}

export class RemoveLeaveDto {
  @idTransform @IsString() @MinLength(1) @MaxLength(20) id: string
}

export class LeaveActionDto {
  @idTransform @IsString() @MinLength(1) @MaxLength(20) id: string
}
