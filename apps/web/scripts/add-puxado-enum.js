require('dotenv').config({ path: 'apps/web/.env.local' });
const { Client } = require('pg');

async function addPuxadoEnum() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    await client.query(`
      ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'puxado';
    `);
    console.log('ALTER TYPE job_status ADD VALUE puxado successful!');
  } catch (e) {
    console.log('job_status enum note:', e.message);
  }

  try {
    await client.query(`
      ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'puxado';
    `);
    console.log('ALTER TYPE request_status ADD VALUE puxado successful!');
  } catch (e) {
    console.log('request_status enum note:', e.message);
  }

  await client.end();
}

addPuxadoEnum().catch(console.error);
