require('dotenv').config({ path: 'apps/web/.env.local' });
const { Client } = require('pg');

async function checkEnums() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  const res = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname IN ('request_status', 'job_status')
    ORDER BY t.typname, e.enumsortorder;
  `);
  console.log('Enums:', res.rows);
  await client.end();
}

checkEnums().catch(console.error);
