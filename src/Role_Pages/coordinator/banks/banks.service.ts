import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'

// Provides the admin-created bank accounts used by coordinator workflows.
@Injectable()
export class BanksService {
  constructor(private readonly db: DatabaseService) {}

  // All bank accounts (created by the admin, stored on the users table) for the
  // New Valuation bank/branch dropdowns.
  async registeredBanks() {
    const r = await this.db.query(
      `SELECT bank_name, branch_name, user_id, first_name, last_name, phone, email, designation
         FROM users WHERE role = 'Bank' ORDER BY bank_name, branch_name`,
    )
    return r.rows.map((u) => ({
      bankName: (u.bank_name as string) || (u.first_name as string) || '—',
      branchName: (u.branch_name as string) || '',
      branchCode: u.user_id as string,
      personName: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
      designation: (u.designation as string) || '',
      contact: (u.phone as string) || '',
      email: (u.email as string) || '',
    }))
  }

}
