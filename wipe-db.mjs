// One-off: delete ALL data from every table (keeps the tables themselves).
// Also resets id sequences so numbering starts fresh (pro001, valuation #1, ...).
// Run:  node wipe-db.mjs
import { readFileSync } from 'fs'
import pg from 'pg'

const env = readFileSync(new URL('./.env', import.meta.url), 'utf8')
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
const url = line ? line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '') : ''
if (!url) {
  console.error('DATABASE_URL not found in .env')
  process.exit(1)
}
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
})

const tables = [
  'to_leaves',
  'site_photos',
  'notifications',
  'messages',
  'applicant_documents',
  'land_analyses',
  'banks',
  'map_analyses',
  'drafts',
  'descriptions',
  'inspections',
  'valuations',
  'project_files',
  'projects',
  'users',
  'valuation_requests',
  'contact_messages',
]

async function main() {
  // Only truncate tables that actually exist — some are created lazily by the
  // app's onModuleInit hooks, so a fresh/partial DB may not have them all yet.
  const existing = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [tables],
  )
  const present = existing.rows.map((r) => r.table_name)
  const missing = tables.filter((t) => !present.includes(t))
  if (missing.length) console.log('Skipping tables not present yet:', missing.join(', '))
  if (!present.length) {
    console.log('No known tables found. Nothing to wipe.')
    await pool.end()
    return
  }

  // CASCADE handles foreign keys; RESTART IDENTITY resets serial/identity ids.
  await pool.query(`TRUNCATE ${present.join(', ')} RESTART IDENTITY CASCADE`)

  // Reset the human-readable id sequences (pro001, val001) back to the start.
  for (const seq of ['project_seq', 'valuation_seq']) {
    try {
      await pool.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`)
    } catch {
      /* sequence may not exist — ignore */
    }
  }

  console.log('All table data removed. Tables kept, id sequences reset.')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
