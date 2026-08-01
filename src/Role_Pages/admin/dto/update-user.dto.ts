import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

// Body for PUT /api/admin/users/:userId (Admin > User Details > Edit).
// Identity fields (userId, role, nic) are never changed here.
export class UpdateUserDto {
  @IsString() @MinLength(1, { message: 'First name is required.' }) @MaxLength(60) firstName: string
  @IsOptional() @IsString() @MaxLength(60) lastName?: string

  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(100) email?: string
  @IsOptional() @IsString() @MaxLength(20) phone?: string

  @IsOptional() @IsString() @MaxLength(60) province?: string
  @IsOptional() @IsString() @MaxLength(60) district?: string
  @IsOptional() @IsString() @MaxLength(60) city?: string
}
