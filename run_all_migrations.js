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

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = ['0199_enums.sql', '0200_on_demand.sql'];

    for (const file of files) {
      console.log(`Applying ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      if (file === '0199_enums.sql') {
         // Run line by line for ADD VALUE
         const stmts = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
         for (const stmt of stmts) {
           try {
             await client.query(stmt);
           } catch (e) {
             if (e.message.includes('already exists') || e.message.includes('already added')) {
               // ignore
             } else {
               throw e;
             }
           }
         }
      } else {
         await client.query(sql);
      }
    }

    console.log('All migrations applied successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

main();
