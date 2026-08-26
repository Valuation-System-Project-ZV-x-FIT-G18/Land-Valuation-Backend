import { ForbiddenException, Injectable } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'
import type { AuthUser } from '../../../Home_Pages/auth/types/auth-user'

@Injectable()
export class TechnicalOfficerProjectAccessService {
  constructor(private readonly db: DatabaseService) {}

  async assertAssigned(projectId: string, user: AuthUser) {
    if (user.role !== 'Technical Officer') {
      throw new ForbiddenException('Only a technical officer can use this project workspace.')
    }
    const result = await this.db.query(
      `SELECT 1 FROM valuations WHERE project_id = $1 AND technical_officer_id = $2 LIMIT 1`,
      [(projectId ?? '').trim(), user.userId],
    )
    if (!result.rowCount) throw new ForbiddenException('This project is not assigned to you.')
  }
}
