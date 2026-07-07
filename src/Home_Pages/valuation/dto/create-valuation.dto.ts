import { IsEmail, IsString, Matches, MinLength } from 'class-validator'

// Describes + validates the body of POST /api/valuation.
export class CreateValuationDto {
  @IsString()
  @MinLength(2, { message: 'Please enter at least 2 characters.' })
  name: string

  @Matches(/^7[1-9]\d{7}$/, {
    message: 'Enter a valid number: 9 digits (e.g. 771234567).',
  })
  phone: string

  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email: string

  // Sri Lankan NIC: 12 digits, or 9 digits followed by V/X.
  @Matches(/^(\d{9}[VvXx]|\d{12})$/, {
    message: 'Enter a valid NIC: 12 digits, or 9 digits followed by V.',
  })
  nic: string

  @IsString()
  @MinLength(5, { message: 'Please add a little more detail.' })
  message: string
}
