import { IsEmail, IsString, Matches, MinLength } from 'class-validator'

// Describes + validates the body of POST /api/contact.
// NestJS checks these rules automatically (via the global ValidationPipe).
export class CreateContactDto {
  @IsString()
  @MinLength(2, { message: 'Please enter at least 2 characters.' })
  name: string

  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email: string

  // Sri Lankan mobile: 9 digits starting 71-79 (the part after +94).
  @Matches(/^7[1-9]\d{7}$/, {
    message: 'Enter a valid number: 9 digits (e.g. 771234567).',
  })
  phone: string

  @IsString()
  @MinLength(10, { message: 'Message should be at least 10 characters.' })
  message: string
}
