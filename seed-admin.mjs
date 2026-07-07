// Seed a single Admin login (id + password only). Run:  node seed-admin.mjs
import { readFileSync } from 'fs'
import pg from 'pg'

const env = readFileSync(new URL('./.env', import.meta.url), 'utf8')
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
const url = line ? line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '') : ''
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
})

// bcrypt hash of 'Test@123' (same as the schema.sql sample accounts).
const HASH = '$2b$10$fTwlHtzwitWDGxL8nr9vxOozjzlpL5mhPKmeaFH4YNH2PUzlcuV7O'

async function main() {
  // first_name / last_name / nic are NOT NULL, so pass minimal values.
  await pool.query(
    `INSERT INTO users (user_id, first_name, last_name, nic, role, password_hash)
     VALUES ('Adm001', 'Admin', '', '', 'Admin', $1)
     ON CONFLICT (user_id) DO NOTHING`,
    [HASH],
  )
  console.log('Admin seeded -> id: Adm001  password: Test@123')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
