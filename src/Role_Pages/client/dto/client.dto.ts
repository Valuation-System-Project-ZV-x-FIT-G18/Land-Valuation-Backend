import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator'

export class PayDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
}

export class VerifySlipDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsBoolean() approve: boolean
}

export class PaySlipDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
}
