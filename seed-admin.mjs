// Bootstrap a single Admin login. Existing profile details are user-owned and
// must never be overwritten by a password/bootstrap seed.
import { readFileSync } from 'fs'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const env = readFileSync(new URL('./.env', import.meta.url), 'utf8')
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
const url = line ? line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '') : ''
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
})

async function main() {
  const passwordHash = await bcrypt.hash('Test@1234', 10)
  // Development bootstrap only. Change the password immediately after login.
  await pool.query(
    `INSERT INTO users (user_id, first_name, last_name, nic, role, email, password_hash)
     VALUES ('Adm001', 'System', 'Administrator', 'ADMIN-001', 'Admin', 'abcd6771563@gmail.com', $1)
     ON CONFLICT (user_id) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       must_change_password = true,
       session_version = users.session_version + 1`,
    [passwordHash],
  )
  console.log('Admin seeded -> id: Adm001  password: Test@1234')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
