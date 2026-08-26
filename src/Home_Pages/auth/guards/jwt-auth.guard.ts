import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import type { AuthUser } from '../types/auth-user'
import { DatabaseService } from '../../../Common_Pages/database/database.service'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string }
      user?: AuthUser
    }>()
    const [scheme, token] = request.headers.authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Authentication required.')

    try {
      const payload = await this.jwt.verifyAsync<AuthUser>(token)
      if (payload.tokenUse !== 'access') throw new Error('Wrong token type')
      const result = await this.db.query(
        `SELECT email, role, account_status, session_version FROM users WHERE user_id = $1 LIMIT 1`,
        [payload.userId],
      )
      const account = result.rows[0]
      if (
        !account ||
        account.account_status !== 'Active' ||
        Number(account.session_version ?? 0) !== Number(payload.sessionVersion)
      ) throw new Error('Session revoked')

      // Use current database identity rather than trusting stale role/email
      // claims for authorization decisions.
      request.user = {
        userId: payload.userId,
        email: account.email as string,
        role: account.role as string,
        sessionVersion: Number(account.session_version ?? 0),
      }
      return true
    } catch {
      throw new UnauthorizedException('Your session is invalid or has expired.')
    }
  }
}

