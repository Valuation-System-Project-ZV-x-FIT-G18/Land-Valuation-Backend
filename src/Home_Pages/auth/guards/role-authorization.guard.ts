import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import type { AuthUser } from '../types/auth-user'

const allowedForPath = (path: string, role: string) => {
  if (path.startsWith('/api/technical-officer/draft/pdf')) {
    return role === 'Technical Officer' || role.startsWith('Manager L') || role === 'Bank'
  }
  if (path.startsWith('/api/technical-officer/site-photos/file')) {
    return role === 'Technical Officer' || role.startsWith('Manager L')
  }
  if (path.startsWith('/api/coordinator/projects/file')) {
    return role === 'Coordinator' || role === 'Technical Officer' || role.startsWith('Manager L')
  }
  if (path.startsWith('/api/admin')) return role === 'Admin'
  if (path.startsWith('/api/contact')) return role === 'Coordinator'
  if (path.startsWith('/api/technical-officer')) return role === 'Technical Officer'
  if (path.startsWith('/api/manager')) return role.startsWith('Manager')
  if (path.startsWith('/api/applicant')) {
    if (path.endsWith('/use')) return role === 'Coordinator'
    return role === 'Loan Applicant'
  }
  if (path.startsWith('/api/coordinator')) {
    // Some fleet endpoints live under /api/coordinator but are actions the
    // technical officer performs on their own work: marking leave, and
    // accepting or rejecting the assignment they were given. The controller
    // takes the officer id from the token for these, so a technical officer
    // can only ever act on their own rows.
    if (
      role === 'Technical Officer' &&
      (
        path.startsWith('/api/coordinator/fleet/leaves') ||
        path.startsWith('/api/coordinator/fleet/mark-leave') ||
        path.startsWith('/api/coordinator/fleet/remove-leave') ||
        path.startsWith('/api/coordinator/fleet/accept-assignment') ||
        // Exact match: /fleet/reject-leave is the coordinator reviewing a
        // leave request, and a prefix match would let an officer action
        // their own.
        path.split('?')[0] === '/api/coordinator/fleet/reject'
      )
    ) return true
    if (
      path.startsWith('/api/coordinator/projects/status') ||
      path.startsWith('/api/coordinator/valuations/by-project') ||
      path.startsWith('/api/coordinator/valuations/status') ||
      path.startsWith('/api/coordinator/valuations/timeline') ||
      path.startsWith('/api/coordinator/valuations/project-timeline')
    ) return true
    return role === 'Coordinator'
  }
  if (path.startsWith('/api/client/applicant')) return role === 'Loan Applicant'
  if (path.startsWith('/api/client/bank')) return role === 'Bank'
  if (path.startsWith('/api/client/pending-slips') || path.startsWith('/api/client/verify-slip') || path.startsWith('/api/client/slip')) {
    return role === 'Coordinator'
  }
  if (path.startsWith('/api/client')) return ['Bank', 'Loan Applicant', 'Coordinator'].includes(role)
  return true
}

@Injectable()
export class RoleAuthorizationGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ originalUrl: string; user?: AuthUser }>()
    if (!request.user || allowedForPath(request.originalUrl, request.user.role)) return true
    throw new ForbiddenException('You do not have permission to use this endpoint.')
  }
}

