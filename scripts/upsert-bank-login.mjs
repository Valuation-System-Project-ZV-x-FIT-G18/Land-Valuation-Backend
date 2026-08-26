import { readFileSync } from 'fs'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const [branchCode, emailArg, password] = process.argv.slice(2)
const email = emailArg?.trim().toLowerCase()
if (!branchCode || !email || !password) {
  console.error('Usage: node scripts/upsert-bank-login.mjs <branchCode> <email> <password>')
  process.exit(1)
}

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const line = env.split(/\r?\n/).find((value) => value.startsWith('DATABASE_URL='))
const url = line?.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '') ?? ''
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
})

const client = await pool.connect()
try {
  await client.query('BEGIN')
  const branchResult = await client.query(
    `SELECT branch.branch_code, branch.branch_name, bank.name AS bank_name,
            COALESCE(contact.full_name, '') AS contact_name,
            COALESCE(contact.phone, '') AS phone
       FROM bank_branches branch
       JOIN bank_organizations bank ON bank.id = branch.bank_id
       LEFT JOIN LATERAL (
         SELECT full_name, phone FROM bank_contacts
          WHERE branch_id = branch.id ORDER BY id LIMIT 1
       ) contact ON true
      WHERE branch.branch_code = $1 LIMIT 1`,
    [branchCode.trim()],
  )
  const branch = branchResult.rows[0]
  if (!branch) throw new Error(`No registered bank branch found with code ${branchCode}.`)

  const emailOwner = await client.query(
    `SELECT user_id FROM users WHERE lower(email) = lower($1) AND user_id <> $2 LIMIT 1`,
    [email, branch.branch_code],
  )
  if (emailOwner.rows[0]) throw new Error(`That email is already used by account ${emailOwner.rows[0].user_id}.`)

  const parts = String(branch.contact_name).trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] || String(branch.bank_name)
  const lastName = parts.slice(1).join(' ') || String(branch.branch_name)
  const initials = `${firstName[0]?.toUpperCase() ?? ''}. ${lastName}`.trim()
  const hash = await bcrypt.hash(password, 10)

  await client.query(
    `INSERT INTO users
       (user_id, first_name, last_name, initials, nic, role, email, phone,
        branch_name, bank_name, designation, password_hash, must_change_password,
        account_status)
     VALUES ($1,$2,$3,$4,$5,'Bank',$6,$7,$8,$9,'Bank Representative',$10,false,'Active')
     ON CONFLICT (user_id) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       initials = EXCLUDED.initials,
       role = 'Bank',
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       branch_name = EXCLUDED.branch_name,
       bank_name = EXCLUDED.bank_name,
       password_hash = EXCLUDED.password_hash,
       must_change_password = false,
       account_status = 'Active',
       session_version = users.session_version + 1`,
    [
      branch.branch_code, firstName, lastName, initials, `BANK-${branch.branch_code}`,
      email, branch.phone, branch.branch_name, branch.bank_name, hash,
    ],
  )
  await client.query(
    `UPDATE bank_contacts SET email = $2
      WHERE id = (SELECT id FROM bank_contacts WHERE branch_id = (
        SELECT id FROM bank_branches WHERE branch_code = $1 LIMIT 1
      ) ORDER BY id LIMIT 1)`,
    [branch.branch_code, email],
  )
  await client.query('COMMIT')
  console.log(`Bank login is active for branch ${branch.branch_code} using ${email}.`)
} catch (error) {
  await client.query('ROLLBACK')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
