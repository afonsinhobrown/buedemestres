require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function updateServiceJobs() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('Updating service_jobs table for Escrow and Payments...');

  await client.query(`
    -- Adicionar colunas de negócio e financeiras
    ALTER TABLE service_jobs 
    ADD COLUMN IF NOT EXISTS problem_description text,
    ADD COLUMN IF NOT EXISTS quoted_price numeric(12,2),
    ADD COLUMN IF NOT EXISTS payment_status text check (payment_status in ('unpaid', 'held_in_escrow', 'released', 'refunded')) default 'unpaid';

    -- Actualizar os estados do serviço permitidos (Remover restrição antiga e adicionar a nova com estado 'negotiating')
    ALTER TABLE service_jobs DROP CONSTRAINT IF EXISTS service_jobs_status_check;
    ALTER TABLE service_jobs ADD CONSTRAINT service_jobs_status_check 
      CHECK (status in ('pending', 'negotiating', 'awaiting_payment', 'em_deslocacao', 'in_progress', 'completed', 'cancelled'));
  `);

  console.log('service_jobs table updated successfully.');
  await client.end();
}

updateServiceJobs();
