require('dotenv').config({ path: '../../.env.local' });
const { Client } = require('pg');

async function fixTrigger() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('Fixing trigger infinite loop...');
  await client.query(`
    CREATE OR REPLACE FUNCTION trg_refresh_search_provider() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
      END IF;
      PERFORM refresh_provider_search(NEW.profile_id);
      RETURN NEW;
    END $$;
  `);

  console.log('Fixed trigger.');
  await client.end();
}

fixTrigger();
