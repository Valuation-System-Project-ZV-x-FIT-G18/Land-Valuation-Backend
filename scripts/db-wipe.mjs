import { createPool } from './db-utils.mjs'

if (!process.argv.includes('--confirm')) {
  console.error('Refusing to wipe data without --confirm')
  process.exit(1)
}

const pool = createPool()
try {
  const result = await pool.query(`
    SELECT quote_ident(tablename) AS name
      FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
     ORDER BY tablename
  `)
  if (result.rows.length) {
    await pool.query(`TRUNCATE TABLE ${result.rows.map((row) => row.name).join(', ')} RESTART IDENTITY CASCADE`)
  }
  console.log(`Removed data from ${result.rows.length} application tables.`)
} finally {
  await pool.end()
}
