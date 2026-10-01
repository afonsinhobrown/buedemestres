require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB.');

    const m199 = fs.readFileSync(path.join(__dirname, 'migrations/0199_enums.sql'), 'utf8');
    const m200 = fs.readFileSync(path.join(__dirname, 'migrations/0200_on_demand.sql'), 'utf8');

    console.log('Applying 0199_enums.sql...');
    // We run it line by line or statement by statement because ADD VALUE cannot be in a transaction block
    const stmts199 = m199.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of stmts199) {
      try {
        await client.query(stmt);
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('already added')) {
          console.log('Skipping existing enum value');
        } else {
          throw e;
        }
      }
    }

    console.log('Applying 0200_on_demand.sql...');
    await client.query(m200);

    console.log('Migrations applied successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

main();
