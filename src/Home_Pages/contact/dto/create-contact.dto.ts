import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { PHONE_MESSAGE, REQUIRED_PHONE_PATTERN } from '../../../Common_Pages/validation/patterns'

export class CreateContactDto {
  @IsString()
  @MinLength(2, { message: 'Please enter at least 2 characters.' })
  @MaxLength(100)
  name: string

  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(100)
  email: string

  @Matches(REQUIRED_PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone: string

  @IsString()
  @MinLength(10, { message: 'Message should be at least 10 characters.' })
  @MaxLength(2000)
  message: string
}
