/*This function checks whether a given NIC or email is already used by another user in the shared users table.
It ignores blank values, compares emails without case sensitivity, and can exclude the current user during an update. It returns 'nic', 'email', or null if no duplicate exists.
*/

import { DatabaseService } from './database.service'

// Checks whether a NIC or email is already used by another account in the
// shared `users` table (across every role — Admin, Coordinator, Technical
// Officer, Managers, Bank, Loan Applicant all share this one table).
// Blank values are ignored — some accounts legitimately have no NIC or email
// (e.g. the seeded Admin, or a Bank login registered without an email).
// Pass `excludeUserId` when checking during an edit, so a user doesn't get
// flagged as conflicting with their own existing row.
export async function findDuplicateUserField(
  db: DatabaseService,
  fields: { nic?: string; email?: string },
  excludeUserId?: string,
): Promise<'nic' | 'email' | null> {
  const nic = (fields.nic ?? '').trim()
  const email = (fields.email ?? '').trim()

  if (nic) {
    const r = await db.query(
      `SELECT 1 FROM users WHERE nic = $1 ${excludeUserId ? 'AND user_id <> $2' : ''} LIMIT 1`,
      excludeUserId ? [nic, excludeUserId] : [nic],
    )
    if (r.rows.length) return 'nic'
  }
  if (email) {
    const r = await db.query(
      `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) ${excludeUserId ? 'AND user_id <> $2' : ''} LIMIT 1`,
      excludeUserId ? [email, excludeUserId] : [email],
    )
    if (r.rows.length) return 'email'
  }
  return null
}
