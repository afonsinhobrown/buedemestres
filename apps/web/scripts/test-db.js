import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.local' }); // From apps/web/scripts

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = $1', ['public']);
    console.log('Tables:', res.rows.map(r => r.table_name));
    pool.end();
  } catch(e) {
    console.error(e);
  }
}
test();
