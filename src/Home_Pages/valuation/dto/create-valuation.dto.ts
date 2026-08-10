import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { PHONE_MESSAGE, REQUIRED_PHONE_PATTERN } from '../../../Common_Pages/validation/patterns'

export class CreateValuationDto {
  @IsString()
  @MinLength(2, { message: 'Please enter at least 2 characters.' })
  @MaxLength(100)
  name: string

  @Matches(REQUIRED_PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone: string

  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(100)
  email: string

  @Matches(/^(\d{9}[VvXx]|\d{12})$/, {
    message: 'Enter a valid NIC: 12 digits, or 9 digits followed by V.',
  })
  nic: string

  @IsString()
  @MinLength(5, { message: 'Please add a little more detail.' })
  @MaxLength(2000)
  message: string
}
