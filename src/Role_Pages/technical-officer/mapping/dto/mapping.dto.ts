
//01
import { IsArray, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

export class SaveMappingDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsNumber() @Min(-90) @Max(90) lat: number
  @IsNumber() @Min(-180) @Max(180) lng: number
  @IsString() @MaxLength(3000) accessDescription: string
  @IsString() @MaxLength(3000) localityDescription: string
  @IsOptional() @IsArray() @IsString({ each: true }) accessSources?: string[]
  @IsOptional() @IsArray() @IsString({ each: true }) localitySources?: string[]
}
