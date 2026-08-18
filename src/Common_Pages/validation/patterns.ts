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
// Lankan local number. Forms collect the 9-digit local part, so both mobile
// and landline numbers are accepted (e.g. +94771234567, +94112345678).
export const REQUIRED_PHONE_PATTERN =
  /^(?:(?:70|71|72|74|75|76|77|78)|(?:11|21|23|24|25|26|27|31|32|33|34|35|36|37|38|41|45|47|51|52|54|55|57|63|65|66|67|81|91))\d{7}$/
export const PHONE_PATTERN =
  /^(?:$|(?:(?:70|71|72|74|75|76|77|78)|(?:11|21|23|24|25|26|27|31|32|33|34|35|36|37|38|41|45|47|51|52|54|55|57|63|65|66|67|81|91))\d{7})$/
export const PHONE_MESSAGE = 'Enter a valid Sri Lankan mobile or landline number after +94 (e.g. 771234567 or 112345678).'

export const NIC_PATTERN = /^(\d{9}[VvXx]|\d{12})$/
export const NIC_MESSAGE = 'Enter a valid NIC: 12 digits, or 9 digits followed by V or X.'

export const POSTAL_CODE_PATTERN = /^\d{4,5}$/
export const POSTAL_CODE_MESSAGE = 'Enter a valid postal code (4–5 digits).'

export const BRANCH_CODE_PATTERN = /^[A-Za-z0-9-]+$/
export const BRANCH_CODE_MESSAGE = 'Branch code can contain letters, numbers and hyphens only.'

// Combines a validated 9-digit local number with the fixed "+94" prefix to
// produce the exact string stored in the database. Returns '' when no digits
// were provided, so optional phone fields stay blank instead of "+94".
export function toStoredPhone(raw: string | undefined | null): string {
  let digits = (raw ?? '').replace(/\D/g, '')
  if (digits.startsWith('94')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
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
