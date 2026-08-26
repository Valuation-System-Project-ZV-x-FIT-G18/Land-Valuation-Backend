import { createPool } from './db-utils.mjs'

const pool = createPool()
try {
  const migration = await pool.query(`SELECT version, applied_at FROM schema_migrations ORDER BY version`)
  const tables = await pool.query(`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`)
  const constraints = await pool.query(`
    SELECT contype, count(*)::int AS count FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' GROUP BY contype ORDER BY contype
  `)
  const missingProjectForeignKeys = await pool.query(`
    SELECT table_name FROM information_schema.columns c
    WHERE table_schema = 'public' AND column_name = 'project_id'
      AND table_name NOT IN ('projects', 'applicant_documents')
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.key_column_usage k
        JOIN information_schema.table_constraints tc
          ON tc.constraint_name = k.constraint_name AND tc.constraint_schema = k.constraint_schema
        WHERE k.table_schema = c.table_schema AND k.table_name = c.table_name
          AND k.column_name = c.column_name AND tc.constraint_type = 'FOREIGN KEY'
      )
  `)
  const versions = migration.rows.map((row) => row.version)
  if (!versions.includes('003_refresh_sessions')) {
    throw new Error('Latest migration is not applied. Run `npm run db:migrate`.')
  }
  if (missingProjectForeignKeys.rows.length) {
    throw new Error(`Missing project foreign keys: ${missingProjectForeignKeys.rows.map((r) => r.table_name).join(', ')}`)
  }
  console.log(JSON.stringify({ migrations: versions, applicationTables: tables.rows[0].count, constraints: constraints.rows, status: 'healthy' }, null, 2))
} finally {
  await pool.end()
}
