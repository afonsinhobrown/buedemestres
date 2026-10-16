require('dotenv').config({ path: 'apps/web/.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  await client.query(`
    ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon insert support_tickets" ON support_tickets;
    CREATE POLICY "Allow anon insert support_tickets" ON support_tickets FOR INSERT WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow anon select support_tickets" ON support_tickets;
    CREATE POLICY "Allow anon select support_tickets" ON support_tickets FOR SELECT USING (true);
    GRANT ALL ON support_tickets TO anon, authenticated, service_role;
  `);
  console.log('Permissions on support_tickets granted!');
  await client.end();
}

main().catch(console.error);
