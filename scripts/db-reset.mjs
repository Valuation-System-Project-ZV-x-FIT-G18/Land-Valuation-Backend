import { createPool } from './db-utils.mjs'

if (!process.argv.includes('--confirm')) {
  console.error('Refusing to reset without --confirm')
  process.exit(1)
}

const pool = createPool()
try {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  console.log('Database schema reset. Run `npm run db:migrate` next.')
} finally {
  await pool.end()
}
