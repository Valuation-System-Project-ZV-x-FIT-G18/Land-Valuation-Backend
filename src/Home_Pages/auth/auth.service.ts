import { Injectable, UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { UsersService } from './users.service'
import { MailService } from '../../Common_Pages/mail/mail.service'
import { LoginDto } from './dto/login.dto'
import { ChangePasswordDto } from './dto/change-password.dto'

// Login + password-change logic. Works for staff and loan applicants (both live
// in the `users` table; a loan applicant's user_id is their NIC).
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users.findById(dto.userId)
    if (!user || !bcrypt.compareSync(dto.password, user.password_hash)) {
      throw new UnauthorizedException('Invalid ID or password.')
    }
    // Return safe fields only (never the password hash).
    return {
      userId: user.user_id,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
      mustChangePassword: user.must_change_password,
      photoPath: (user as { photo_path?: string }).photo_path ?? '',
    }
  }

  // Forgot password: generate a new temporary password, email it (with the
  // login ID) to the registered address, and force a change on next login.
  // Always returns { ok: true } so we never reveal whether an account exists.
  async forgotPassword(identifier: string) {
    const user = await this.users.findByIdentifier(identifier)
    const email = (user?.email ?? '').trim()
    if (user && email) {
      const newPassword = `Codehub@${Math.floor(1000 + Math.random() * 9000)}`
      const hash = await bcrypt.hash(newPassword, 10)
      await this.users.resetPassword(user.user_id, hash)
      await this.mail.sendPasswordReset(email, user.user_id, newPassword)
    }
    return { ok: true }
  }

  // Change a user's password after verifying the current one.
  async changePassword(dto: ChangePasswordDto) {
    const user = await this.users.findById(dto.userId)
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
