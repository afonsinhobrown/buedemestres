require('dotenv').config({ path: 'apps/web/.env.local' });
const { Client } = require('pg');

async function addEnum() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  try {
    await client.query(`
      ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'price_proposed';
    `);
    console.log('ALTER TYPE request_status ADD VALUE price_proposed successful!');
  } catch (e) {
    console.log('Enum note:', e.message);
  }

  await client.end();
}

addEnum().catch(console.error);
