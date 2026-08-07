// Shared validation regexes, reused across DTOs so the rules stay identical
// everywhere they are enforced (mirrors the frontend's Common_Pages/validation).

// Letters and spaces only — no digits or symbols. Allows an empty string so
// this can be combined with @IsOptional() on fields that aren't required
// (required-ness is still enforced separately via @MinLength/@IsNotEmpty).
export const NAME_PATTERN = /^[A-Za-z\s]*$/
export const NAME_MESSAGE = 'Can only contain letters.'

// A city name must not contain digits (also allows an empty string for the
// same reason as NAME_PATTERN above).
export const CITY_PATTERN = /^\D*$/
export const CITY_MESSAGE = 'City cannot contain numbers.'

// A phone number is stored as the fixed "+94" prefix plus a 9-digit Sri
// Lankan mobile number starting with 7 (e.g. +94712345678). Forms only
// collect the 9-digit local part; PHONE_PATTERN validates that part and is
// for optional fields (an empty string is also accepted); required phone
// fields should also add @IsNotEmpty or rely on @Matches alone without
// @IsOptional.
export const PHONE_PATTERN = /^$|^7[1-9]\d{7}$/
export const PHONE_MESSAGE = 'Enter a valid 9-digit mobile number starting with 7 (e.g. 712345678).'

// Combines a validated 9-digit local number with the fixed "+94" prefix to
// produce the exact string stored in the database. Returns '' when no digits
// were provided, so optional phone fields stay blank instead of "+94".
export function toStoredPhone(raw: string | undefined | null): string {
  const digits = (raw ?? '').trim()
  return digits ? `+94${digits}` : ''
}

// The inverse of toStoredPhone(): strips the "+94" prefix back off a stored
// number so an edit form can be pre-filled with just the 9-digit local part
// (what PHONE_PATTERN and the "+94" prefix input both expect). Used wherever
// a stored phone is loaded back into an editable form.
export function fromStoredPhone(stored: string | undefined | null): string {
  return (stored ?? '').replace(/^\+94/, '')
}

// Strong password: 8+ chars, at least one uppercase, one lowercase, one
// digit and one symbol.
export const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/
export const STRONG_PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit and a symbol.'
