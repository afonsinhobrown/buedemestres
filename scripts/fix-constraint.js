require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

// Migração idempotente: suporta o ciclo completo on-demand em service_jobs
async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  await client.query(`
    ALTER TABLE service_jobs
      ADD COLUMN IF NOT EXISTS reference_point text,
      ADD COLUMN IF NOT EXISTS quote_items jsonb,
      ADD COLUMN IF NOT EXISTS commission_amount numeric(12,2),
      ADD COLUMN IF NOT EXISTS payment_method text,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();
  `);

  await client.query('ALTER TABLE service_jobs DROP CONSTRAINT IF EXISTS service_jobs_status_check;');
  await client.query(`
    ALTER TABLE service_jobs ADD CONSTRAINT service_jobs_status_check
    CHECK (status in ('pending','accepted','em_deslocacao','negotiating','awaiting_payment',
                      'in_progress','awaiting_confirmation','completed','cancelled','rejected'));
  `);

  console.log('service_jobs migrado: colunas e estados do ciclo completo.');
  await client.end();
}

migrate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
