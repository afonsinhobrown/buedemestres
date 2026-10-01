require('dotenv').config({ path: '../../.env.local' });
const { Client } = require('pg');

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('Seeding fake providers...');

  // 1. Insert Profile 1
  await client.query(`
    INSERT INTO profiles (id, full_name, role) 
    VALUES ('11111111-1111-1111-1111-111111111111', 'Mabunda Admin', 'provider')
    ON CONFLICT DO NOTHING;
  `);
  // Insert Provider Profile 1
  await client.query(`
    INSERT INTO provider_profiles (profile_id, slug, business_name, headline, bio, primary_category_id, district_id, address, lat, lng, verification, is_published, is_available, rating_avg, rating_count, jobs_completed) 
    VALUES ('11111111-1111-1111-1111-111111111111', 'oficina-mabunda', 'Oficina Mabunda', 'Pneus e rodas', 'Oficina de mecânica geral na Polana.', (SELECT id FROM categories WHERE slug='mecanico'), (SELECT id FROM districts WHERE name='KaMpfumo'), 'Polana, Maputo', -25.966, 32.589, 'approved', true, true, 4.8, 31, 126)
    ON CONFLICT (profile_id) DO NOTHING;
  `);

  // 2. Insert Profile 2
  await client.query(`
    INSERT INTO profiles (id, full_name, role) 
    VALUES ('22222222-2222-2222-2222-222222222222', 'Cossa Admin', 'provider')
    ON CONFLICT DO NOTHING;
  `);
  // Insert Provider Profile 2
  await client.query(`
    INSERT INTO provider_profiles (profile_id, slug, business_name, headline, primary_category_id, district_id, address, lat, lng, verification, is_published, is_available, rating_avg, rating_count, jobs_completed) 
    VALUES ('22222222-2222-2222-2222-222222222222', 'auto-electrica-cossa', 'Auto Eléctrica Cossa', 'Electricidade auto', (SELECT id FROM categories WHERE slug='electricista-auto'), (SELECT id FROM districts WHERE name='KaMpfumo'), 'Sommerschield, Maputo', -25.955, 32.599, 'approved', true, true, 4.7, 54, 210)
    ON CONFLICT (profile_id) DO NOTHING;
  `);

  console.log('Done seeding test providers.');
  await client.end();
}

seed();
