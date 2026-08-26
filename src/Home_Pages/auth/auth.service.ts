import { Injectable, UnauthorizedException } from '@nestjs/common'
import { randomInt } from 'crypto'
import * as bcrypt from 'bcryptjs'
import { UsersService } from './users.service'
import { MailService } from '../../Common_Pages/mail/mail.service'
import { LoginDto } from './dto/login.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { JwtService } from '@nestjs/jwt'

// A temporary password for a password reset. It has to satisfy the same
// strength rule as a user-chosen one (upper, lower, digit, symbol, 8+).
//
// Math.random() is not a security RNG and a fixed prefix plus four digits
// left only 9,000 possibilities, so a reset mail was worth guessing.
// randomInt() draws from the OS entropy source instead.
const temporaryPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I/O — unreadable in an email
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789' // no 0/1 for the same reason
  const symbols = '!@#$%&*?'
  const all = upper + lower + digits + symbols
  const pick = (set: string) => set[randomInt(set.length)]
  // One of each required class, then fill to 14 characters.
  const characters = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  while (characters.length < 14) characters.push(pick(all))
  // Shuffle so the required characters are not always in the same slots.
  for (let i = characters.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    ;[characters[i], characters[j]] = [characters[j], characters[i]]
  }
  return characters.join('')
}

// Login + password-change logic. Works for staff and loan applicants (both live
// in the `users` table; a loan applicant's user_id is their NIC).
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email)
    if (!user || !bcrypt.compareSync(dto.password, user.password_hash)) {
      throw new UnauthorizedException('Invalid email or password.')
    }
    if (user.account_status !== 'Active') {
      throw new UnauthorizedException('This account is not active. Please contact an administrator.')
    }
    await this.users.recordSuccessfulLogin(user.user_id)
    // Return safe fields only (never the password hash).
    const safeUser = {
      userId: user.user_id,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
      mustChangePassword: user.must_change_password,
      photoPath: (user as { photo_path?: string }).photo_path ?? '',
    }
    return { user: safeUser, ...(await this.issueTokens(user)) }
  }

  private async issueTokens(user: { user_id: string; email: string; role: string; session_version?: number }) {
    const identity = {
      userId: user.user_id,
      email: user.email,
      role: user.role,
      sessionVersion: Number(user.session_version ?? 0),
    }
    const accessToken = await this.jwt.signAsync(
      { ...identity, tokenUse: 'access' },
      { expiresIn: '1h' },
    )
    const refreshToken = await this.jwt.signAsync(
      { ...identity, tokenUse: 'refresh' },
      { expiresIn: '7d' },
    )
    return { accessToken, refreshToken }
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{
        userId: string
        tokenUse: string
        sessionVersion: number
      }>(refreshToken)
      if (payload.tokenUse !== 'refresh') throw new Error('Wrong token type')
      const user = await this.users.findById(payload.userId)
      if (!user || user.account_status !== 'Active' || Number(user.session_version ?? 0) !== Number(payload.sessionVersion)) {
        throw new Error('Session revoked')
      }
      return this.issueTokens(user)
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again.')
    }
  }

  async logout(userId: string) {
    await this.users.revokeSessions(userId)
  }

  // Generate a temporary password for the account matching this email and
  // force a password change on the next login.
  // Always returns { ok: true } so we never reveal whether an account exists.
  async forgotPassword(emailAddress: string) {
    const user = await this.users.findByEmail(emailAddress)
    const email = (user?.email ?? '').trim()
    if (user && email) {
      const newPassword = temporaryPassword()
      const hash = await bcrypt.hash(newPassword, 10)
      await this.users.resetPassword(user.user_id, hash)
      await this.mail.sendPasswordReset(email, newPassword)
    }
    return { ok: true }
  }

  // Change a user's password after verifying the current one.
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findById(userId)
    if (!user || !bcrypt.compareSync(dto.currentPassword, user.password_hash)) {
      throw new UnauthorizedException('Current password is incorrect.')
    }
    const hash = await bcrypt.hash(dto.newPassword, 10)
    await this.users.setPassword(user.user_id, hash)
    return {
      userId: user.user_id,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
      mustChangePassword: false,
      photoPath: user.photo_path ?? '',
    }
  }
}
