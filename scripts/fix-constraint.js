require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function fixConstraint() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Altering constraint on service_jobs...');
  await client.query('ALTER TABLE service_jobs DROP CONSTRAINT IF EXISTS service_jobs_status_check;');
  await client.query(`
    ALTER TABLE service_jobs ADD CONSTRAINT service_jobs_status_check 
    CHECK (status in ('pending', 'accepted', 'negotiating', 'awaiting_payment', 'em_deslocacao', 'in_progress', 'completed', 'cancelled', 'rejected'));
  `);
  console.log('Constraint updated successfully with accepted and rejected.');
  await client.end();
}

fixConstraint().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
