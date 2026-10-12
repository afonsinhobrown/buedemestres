import 'server-only'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL!

const isCloudDb = Boolean(
  connectionString && (
    connectionString.includes('neon.tech') ||
    connectionString.includes('supabase.com') ||
    connectionString.includes('sslmode=require')
  )
)

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: pg.Pool | undefined
}

// Pool singleton para reutilização de ligações (preservado em dev para evitar leak em hot-reload)
const pool =
  globalThis._pgPool ??
  new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    ssl: isCloudDb ? { rejectUnauthorized: false } : false,
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis._pgPool = pool
}

export const db = {
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => pool.query<T>(text, params),

  /** Executa múltiplas queries numa transacção */
  transaction: async <T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },
}
