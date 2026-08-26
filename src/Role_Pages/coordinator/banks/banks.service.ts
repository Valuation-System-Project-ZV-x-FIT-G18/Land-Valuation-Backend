import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../../Common_Pages/database/database.service'

// Provides the admin-created bank accounts used by coordinator workflows.
@Injectable()
export class BanksService {
  constructor(private readonly db: DatabaseService) {}

  async registeredBanks() {
    const r = await this.db.query(
      `SELECT bank.name AS bank_name, branch.branch_name, branch.branch_code,
              contact.full_name, contact.phone, contact.email, contact.designation
         FROM bank_branches branch
         JOIN bank_organizations bank ON bank.id = branch.bank_id
         LEFT JOIN LATERAL (
           SELECT full_name, phone, email, designation FROM bank_contacts
            WHERE branch_id = branch.id ORDER BY id LIMIT 1
         ) contact ON true
        ORDER BY bank.name, branch.branch_name`,
    )
    return r.rows.map((u) => ({
      bankName: (u.bank_name as string) || '—',
      branchName: (u.branch_name as string) || '',
      branchCode: u.branch_code as string,
      personName: (u.full_name as string) || '',
      designation: (u.designation as string) || '',
      contact: (u.phone as string) || '',
      email: (u.email as string) || '',
    }))
  }

}
