require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    // Enable insert without auth for testing
    await client.query("DROP POLICY IF EXISTS \"Permitir tudo provisoriamente\" ON service_requests;");
    await client.query("CREATE POLICY \"Permitir tudo provisoriamente\" ON service_requests FOR ALL USING (true) WITH CHECK (true);");
    console.log('Criada policy provisória para permitir inserts anonimos.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
