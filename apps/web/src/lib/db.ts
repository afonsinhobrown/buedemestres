import 'server-only'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL!

// Pool singleton para reutilização de ligações
const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: false
})

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
