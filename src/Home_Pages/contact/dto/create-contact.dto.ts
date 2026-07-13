import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class CreateContactDto {
  @IsString()
  @MinLength(2, { message: 'Please enter at least 2 characters.' })
  @MaxLength(100)
  name: string

  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(100)
  email: string

  @Matches(/^7[1-9]\d{7}$/, {
    message: 'Enter a valid number: 9 digits (e.g. 771234567).',
  })
  phone: string

  @IsString()
  @MinLength(10, { message: 'Message should be at least 10 characters.' })
  @MaxLength(2000)
  message: string
}
