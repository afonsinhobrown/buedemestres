import 'server-only'
import pg from 'pg'

const rawConnectionString = process.env.DATABASE_URL!;

function normalizeConnectionString(raw: string): string {
  try {
    const url = new URL(raw);
    // Supabase: 5432 é session mode (limite baixo de clientes). Em serverless
    // usamos o transaction pooler (6543) para não esgotar as ligações.
    if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '5432') {
      url.port = '6543';
    }
    if (!url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const connectionString = normalizeConnectionString(rawConnectionString);

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
    max: 3,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 20000,
    allowExitOnIdle: true,
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
