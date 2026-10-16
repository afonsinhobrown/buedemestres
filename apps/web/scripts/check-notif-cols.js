require('dotenv').config({ path: 'apps/web/.env.local' });
const { Client } = require('pg');

async function checkCols() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'notifications';
  `);
  console.log('notifications columns:', res.rows);
  await client.end();
}

checkCols().catch(console.error);
