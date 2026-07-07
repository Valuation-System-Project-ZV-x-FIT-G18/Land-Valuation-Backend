import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { Pool, QueryResult } from 'pg'

// Wraps a single PostgreSQL connection pool, shared across the whole app.
// Other services inject this and call `query(...)`.
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  private readonly pool: Pool

  constructor() {
    const connectionString = process.env.DATABASE_URL
    // Cloud databases (Neon) need SSL; a local one usually does not.
    const isLocal = !connectionString || connectionString.includes('localhost')
    this.pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
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

  // Close the pool when the app shuts down.
  onModuleDestroy() {
    return this.pool.end()
  }
}
