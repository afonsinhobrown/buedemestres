require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function createServiceJobs() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('Creating service_jobs table...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS service_jobs (
      id uuid primary key default gen_random_uuid(),
      client_id uuid references profiles(id),
      provider_id uuid references provider_profiles(profile_id),
      status text check (status in ('pending', 'em_deslocacao', 'in_progress', 'completed', 'cancelled')) default 'em_deslocacao',
      client_lat numeric(9,6),
      client_lng numeric(9,6),
      created_at timestamptz default now()
    );
  `);

  console.log('service_jobs table created successfully.');
  await client.end();
}

createServiceJobs();
