require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    await client.query("INSERT INTO profiles (id, full_name, role) VALUES ('80000000-0000-0000-0000-800000000008', 'Cliente Web', 'client') ON CONFLICT DO NOTHING;");
    console.log('Criado cliente mock.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
