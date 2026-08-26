import { readFileSync } from 'node:fs'
import pg from 'pg'

export function databaseUrl() {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const line = env.split(/\r?\n/).find((value) => value.trimStart().startsWith('DATABASE_URL='))
  const value = line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') ?? ''
  if (!value) throw new Error('DATABASE_URL is not configured in .env')
  return value
}

export function createPool() {
  const connectionString = databaseUrl()
  return new pg.Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  })
}
