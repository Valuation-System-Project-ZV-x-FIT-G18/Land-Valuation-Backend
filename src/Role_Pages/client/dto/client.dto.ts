import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class VerifySlipDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsBoolean() approve: boolean
  @IsOptional() @IsString() @MaxLength(300) reason?: string
}

export class PaySlipDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
}
