const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: false });

async function test() {
  try {
    const res = await pool.query("SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'");
    console.log('Realtime tables:', res.rows.map(r => r.tablename));
    
    // Check latest request
    const reqs = await pool.query('SELECT * FROM service_requests ORDER BY created_at DESC LIMIT 1');
    console.log('Last Request:', reqs.rows[0]);
    
    // Make sure service_requests is in realtime publication
    if (!res.rows.find(r => r.tablename === 'service_requests')) {
      console.log('Adding service_requests to realtime...');
      await pool.query('alter publication supabase_realtime add table service_requests;');
      console.log('Done.');
    }
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
test();
