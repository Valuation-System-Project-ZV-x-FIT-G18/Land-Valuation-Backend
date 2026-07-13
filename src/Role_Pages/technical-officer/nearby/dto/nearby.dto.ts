import { IsObject, IsString, MaxLength, MinLength } from 'class-validator'

export class AnalyseDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsObject() input: object
}

export class SaveAnalysisDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsObject() data: Record<string, unknown>
}
