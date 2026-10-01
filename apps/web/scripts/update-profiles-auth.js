require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function updateProfilesAuth() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('Adding password/PIN column to profiles...');

  await client.query(`
    ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS pin_hash text;
  `);

  console.log('Profiles table updated successfully.');
  await client.end();
}

updateProfilesAuth();
