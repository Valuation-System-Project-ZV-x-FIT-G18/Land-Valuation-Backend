/*This service manages the NestJS application’s PostgreSQL connection pool. It connects using `DATABASE_URL`, enables SSL for cloud databases, executes SQL queries, handles idle connection errors, and closes connections when the app shuts down.*/

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Pool, PoolClient, QueryResult } from 'pg'

// Wraps a single PostgreSQL connection pool, shared across the whole app.
// Other services inject this and call `query(...)`.
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  private readonly pool: Pool

  constructor() {
    const connectionString = process.env.DATABASE_URL
    // Cloud databases (Neon) need SSL; a local one usually does not.
    const isLocal = !connectionString || connectionString.includes('localhost')
    this.pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      // Do not let application startup hang forever when the cloud database is
      // asleep or temporarily unreachable. Callers can report/retry the error.
      //
      // Neon suspends an idle compute and takes ~20s to wake it, so a 10s
      // budget made the first connection after any quiet period always fail.
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 45_000),
      statement_timeout: 10_000,
      query_timeout: 12_000,
    })
    // Idle cloud connections (e.g. Neon) get dropped; the pool emits an 'error'
    // event for that. Without a listener, Node treats it as uncaught and crashes.
    // Log and ignore — the pool reconnects on the next query.
    this.pool.on('error', (err) => {
      this.logger.warn(`Idle DB client error (ignored): ${err.message}`)
    })
  }

  query(text: string, params?: unknown[]): Promise<QueryResult> {
    return this.pool.query(text, params)
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await work(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async onModuleInit() {
    let result
    try {
      result = await this.pool.query(
        `SELECT 1 FROM schema_migrations WHERE version = $1`,
        ['007_official_branch_codes'],
      )
    } catch (error) {
      // Not being able to reach the database is a different problem from a
      // reachable database that is missing a migration. Reporting both as
      // "not migrated" sends anyone debugging a cold start after the wrong fix.
      this.logger.error(
        `Could not reach the database: ${(error as Error).message}. ` +
          'Check DATABASE_URL; a suspended Neon compute also needs ~20s to wake.',
      )
      throw error
    }
    if (!result.rows[0]) {
      this.logger.error(
        'Database is reachable but not migrated. Run `npm run db:migrate` before starting the API.',
      )
      throw new Error('Required migration 007_official_branch_codes is not applied')
    }
  }

  // Close the pool when the app shuts down.
  onModuleDestroy() {
    return this.pool.end()
  }
}
