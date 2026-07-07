import { IsOptional, IsString, MinLength } from 'class-validator'

// Body of PUT /api/auth/profile. Only personal fields are editable — user_id,
// role, nic and the password are not changed here.
export class UpdateProfileDto {
  @IsString()
  @MinLength(1, { message: 'User ID is required.' })
  userId: string

  @IsOptional() @IsString() firstName?: string
  @IsOptional() @IsString() lastName?: string
  @IsOptional() @IsString() initials?: string
  @IsOptional() @IsString() email?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() dateOfBirth?: string
  @IsOptional() @IsString() province?: string
  @IsOptional() @IsString() district?: string
  @IsOptional() @IsString() city?: string
  @IsOptional() @IsString() postalCode?: string
  @IsOptional() @IsString() address?: string
}
