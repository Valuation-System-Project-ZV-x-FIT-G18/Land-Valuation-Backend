// Reset a user's password (and clear the first-login flag).
// Usage:  node reset-password.mjs <userId> <newPassword>
import { readFileSync } from 'fs'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const [userId, newPassword] = process.argv.slice(2)
if (!userId || !newPassword) {
  console.error('Usage: node reset-password.mjs <userId> <newPassword>')
  process.exit(1)
}

const env = readFileSync(new URL('./.env', import.meta.url), 'utf8')
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
const url = line ? line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '') : ''
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
})

const hash = await bcrypt.hash(newPassword, 10)
const r = await pool.query(
  `UPDATE users SET password_hash = $1, must_change_password = false WHERE user_id = $2`,
  [hash, userId],
)
console.log(
  r.rowCount
    ? `Password reset for ${userId}. New password: ${newPassword}`
    : `No user found with id ${userId}`,
)
await pool.end()
