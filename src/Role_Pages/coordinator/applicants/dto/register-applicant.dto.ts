import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator'

// Validation for registering a new loan applicant.
// First name, last name and "name with initials" are derived on the client.
export class RegisterApplicantDto {
  @IsString()
  @MinLength(2, { message: 'First name must be at least 2 characters.' })
  firstName: string

  @IsString()
  @MinLength(1)
  lastName: string

  @IsString()
  initials: string // name with initials, e.g. "C.P. Senarathne"

  @Matches(/^(\d{9}[VvXx]|\d{12})$/, { message: 'Enter a valid NIC.' })
  nic: string

  @IsOptional()
  @IsString()
  dateOfBirth?: string // ISO date (yyyy-mm-dd) or empty

  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string

  @Matches(/^07\d{8}$/, { message: 'Enter a valid mobile number (e.g. 0771234567).' })
  phone: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password: string

  // Address details are captured later in the Create Project flow, so they are
  // optional here.
  @IsOptional() @IsString() province?: string
  @IsOptional() @IsString() district?: string
  @IsOptional() @IsString() city?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() postalCode?: string
}
