require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 1. Corrigir o Trigger para evitar o loop infinito!
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_refresh_search_provider() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF pg_trigger_depth() > 1 THEN
          RETURN NEW;
        END IF;
        PERFORM refresh_provider_search(NEW.profile_id);
        RETURN NEW;
      END $$;
    `);

    // E para os serviços:
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_refresh_search_service() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF pg_trigger_depth() > 1 THEN
          RETURN NEW;
        END IF;
        PERFORM refresh_provider_search(COALESCE(NEW.provider_id, OLD.provider_id));
        RETURN NEW;
      END $$;
    `);

    // 2. Apagar todos os dados!
    await client.query('DELETE FROM provider_profiles;');

    // 3. Inserir os 5 provedores
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
      await client.query("INSERT INTO provider_services (provider_id, category_id, title, price_min) VALUES ($1, $2, $3, 1000) ON CONFLICT DO NOTHING;", [p.id, p.category_id, p.service]);
      await client.query("INSERT INTO provider_categories (provider_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;", [p.id, p.category_id]);
      await client.query("INSERT INTO provider_presence (provider_id, is_online, location, categories, updated_at) VALUES ($1, true, ST_SetSRID(ST_MakePoint($2, $3), 4326), ARRAY[$4::int], now() + interval '1 day') ON CONFLICT (provider_id) DO UPDATE SET is_online = true;", [p.id, p.lng, p.lat, p.category_id]);
    }

    console.log('✅ Trigger corrigido e 5 provedores criados perfeitamente!');
  } catch (error) {
    console.error('❌ Falha:', error);
  } finally {
    await client.end();
  }
}

main();
