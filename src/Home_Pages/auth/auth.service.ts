import { Injectable, UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { UsersService } from './users.service'
import { MailService } from '../../Common_Pages/mail/mail.service'
import { LoginDto } from './dto/login.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { JwtService } from '@nestjs/jwt'

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
    // Return safe fields only (never the password hash).
    const safeUser = {
      userId: user.user_id,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
      mustChangePassword: user.must_change_password,
      photoPath: (user as { photo_path?: string }).photo_path ?? '',
    }
    const accessToken = await this.jwt.signAsync({
      userId: user.user_id,
      email: user.email,
      role: user.role,
    })
    return { user: safeUser, accessToken }
  }

  // Generate a temporary password for the account matching this email and
  // force a password change on the next login.
  // Always returns { ok: true } so we never reveal whether an account exists.
  async forgotPassword(emailAddress: string) {
    const user = await this.users.findByEmail(emailAddress)
    const email = (user?.email ?? '').trim()
    if (user && email) {
      const newPassword = `Codehub@${Math.floor(1000 + Math.random() * 9000)}`
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
