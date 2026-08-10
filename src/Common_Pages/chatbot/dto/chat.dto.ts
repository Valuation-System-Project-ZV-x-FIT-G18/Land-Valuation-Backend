import { IsArray, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class ChatHistoryDto {
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant'
  @IsString() @Length(1, 2000) content: string
}

export class ChatDto {
  @IsString() @Length(1, 30) userId: string
  @IsString()
  @IsIn(['Admin', 'Coordinator', 'Technical Officer', 'Manager L1', 'Manager L2', 'Manager L3', 'Loan Applicant', 'Bank'])
  role: string
  @IsString() @Length(1, 1000) message: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryDto)
  history?: ChatHistoryDto[]
}
