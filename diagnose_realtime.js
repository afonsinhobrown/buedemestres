require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // 1. Check publication
    const res = await client.query("SELECT puballtables, pubinsert, pubupdate, pubdelete FROM pg_publication WHERE pubname = 'supabase_realtime'");
    console.log('Publication Settings:', res.rows[0]);

    // 2. Check if table is in publication
    const res2 = await client.query("SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'service_requests'");
    console.log('Table in Publication:', res2.rows);

    // 3. Check Replica Identity
    const res3 = await client.query("SELECT relreplident FROM pg_class WHERE relname = 'service_requests'");
    console.log('Replica Identity (d=default, f=full, n=nothing, i=index):', res3.rows[0]);

  } catch (error) {
    console.error('Falha:', error);
  } finally {
    await client.end();
  }
}

main();
