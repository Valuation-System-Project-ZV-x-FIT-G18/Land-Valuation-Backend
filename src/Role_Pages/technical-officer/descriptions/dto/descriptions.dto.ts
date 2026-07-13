import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class GenerateOneDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsString() @MinLength(1) @MaxLength(60) section: string
  @IsOptional() @IsObject() fields?: Record<string, string>
}

export class SaveDescriptionsDto {
  @IsString() @MinLength(1) @MaxLength(20) projectId: string
  @IsObject() data: Record<string, string>
}
