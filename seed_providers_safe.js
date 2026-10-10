require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Desativar triggers problemáticos
    await client.query('DROP TRIGGER IF EXISTS trg_refresh_search ON provider_profiles;');
    await client.query('DROP TRIGGER IF EXISTS trg_provider_upd ON provider_profiles;');

    const providers = [
      { id: '10000000-0000-0000-0000-100000000001', name: 'Carlos Canalizador', slug: 'carlos-canalizador', category_id: 4, lat: -25.9680, lng: 32.5700, service: 'Roturas' },
      { id: '20000000-0000-0000-0000-200000000002', name: 'Maria Electricista', slug: 'maria-eletricista', category_id: 5, lat: -25.9750, lng: 32.5850, service: 'Energia' },
      { id: '30000000-0000-0000-0000-300000000003', name: 'João Explicador', slug: 'joao-explicador', category_id: 8, lat: -25.9550, lng: 32.5900, service: 'Matemática' },
      { id: '40000000-0000-0000-0000-400000000004', name: 'Ana Limpezas', slug: 'ana-limpezas', category_id: 11, lat: -25.9400, lng: 32.5950, service: 'Pós-Obra' },
      { id: '50000000-0000-0000-0000-500000000005', name: 'Marta Designer', slug: 'marta-designer', category_id: 15, lat: -25.9600, lng: 32.5800, service: 'Logótipos' }
    ];

    for (const p of providers) {
      await client.query("INSERT INTO profiles (id, full_name, role) VALUES ($1, $2, 'provider') ON CONFLICT DO NOTHING;", [p.id, p.name]);
      await client.query("INSERT INTO provider_profiles (profile_id, slug, business_name, is_published, verification, primary_category_id, district_id) VALUES ($1, $2, $3, true, 'approved', $4, 1) ON CONFLICT DO NOTHING;", [p.id, p.slug, p.name, p.category_id]);
      await client.query("INSERT INTO provider_presence (provider_id, is_online, location, categories, updated_at) VALUES ($1, true, ST_SetSRID(ST_MakePoint($2, $3), 4326), ARRAY[$4::int], now() + interval '1 day') ON CONFLICT (provider_id) DO UPDATE SET is_online = true;", [p.id, p.lng, p.lat, p.category_id]);
    }

    console.log('Criados com sucesso!');
  } catch (error) {
    console.error('Falha:', error);
  } finally {
    await client.end();
  }
}

main();
