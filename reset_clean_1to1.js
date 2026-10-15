require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('A limpar todo o lixo e a deixar rigorosamente 1 Cliente e 1 Provedor...');

    // 1. Limpar todas as tabelas de pedidos, propostas, chats e trabalhos
    await client.query(`
      DELETE FROM job_payments;
      DELETE FROM job_price_proposals;
      DELETE FROM job_location_log;
      DELETE FROM messages;
      DELETE FROM conversations;
      DELETE FROM quotes;
      DELETE FROM request_media;
      DELETE FROM request_offers;
      DELETE FROM jobs;
      DELETE FROM service_requests;
    `);

    // 2. Limpar provedores anteriores
    await client.query(`
      DELETE FROM provider_presence;
      DELETE FROM provider_services;
      DELETE FROM provider_categories;
      DELETE FROM provider_media;
      DELETE FROM provider_profiles;
      DELETE FROM profiles WHERE id NOT IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222'
      );
    `);

    // 3. Criar EXACTAMENTE 1 Cliente
    await client.query(`
      INSERT INTO profiles (id, full_name, phone, role)
      VALUES (
        '11111111-1111-1111-1111-111111111111',
        'Cliente 1',
        '+258 84 000 0001',
        'client'
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = 'Cliente 1',
        phone = '+258 84 000 0001',
        role = 'client';
    `);

    // 4. Criar EXACTAMENTE 1 Provedor
    await client.query(`
      INSERT INTO profiles (id, full_name, phone, role)
      VALUES (
        '22222222-2222-2222-2222-222222222222',
        'Provedor 1',
        '+258 84 999 9999',
        'provider'
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = 'Provedor 1',
        phone = '+258 84 999 9999',
        role = 'provider';

      INSERT INTO provider_profiles (
        profile_id,
        slug,
        business_name,
        is_published,
        is_available,
        verification,
        primary_category_id,
        district_id,
        rating_avg
      ) VALUES (
        '22222222-2222-2222-2222-222222222222',
        'provedor-1',
        'Provedor 1',
        true,
        true,
        'approved',
        2,
        1,
        5.0
      )
      ON CONFLICT (profile_id) DO UPDATE SET
        slug = 'provedor-1',
        business_name = 'Provedor 1',
        is_published = true,
        is_available = true,
        verification = 'approved',
        primary_category_id = 2,
        rating_avg = 5.0;

      -- Vincular às categorias de emergência para poder atender pedidos de qualquer tipo no teste
      INSERT INTO provider_categories (provider_id, category_id)
      VALUES
        ('22222222-2222-2222-2222-222222222222', 2),
        ('22222222-2222-2222-2222-222222222222', 10),
        ('22222222-2222-2222-2222-222222222222', 11),
        ('22222222-2222-2222-2222-222222222222', 13),
        ('22222222-2222-2222-2222-222222222222', 8),
        ('22222222-2222-2222-2222-222222222222', 31)
      ON CONFLICT DO NOTHING;

      -- Presença Online e Activa com PostGIS
      INSERT INTO provider_presence (
        provider_id,
        is_online,
        location,
        categories,
        active_job_id,
        updated_at
      ) VALUES (
        '22222222-2222-2222-2222-222222222222',
        true,
        ST_SetSRID(ST_MakePoint(32.5700, -25.9680), 4326),
        ARRAY[2, 10, 11, 13, 8, 31],
        null,
        now()
      )
      ON CONFLICT (provider_id) DO UPDATE SET
        is_online = true,
        location = ST_SetSRID(ST_MakePoint(32.5700, -25.9680), 4326),
        categories = ARRAY[2, 10, 11, 13, 8, 31],
        active_job_id = null,
        updated_at = now();
    `);

    await client.query('COMMIT');
    console.log('✅ Base de dados limpa com sucesso!');
    console.log('👤 1 Cliente: "Cliente 1" (ID: 11111111-1111-1111-1111-111111111111)');
    console.log('🔨 1 Provedor: "Provedor 1" (ID: 22222222-2222-2222-2222-222222222222)');
    console.log('📋 0 Pedidos mocks (pronto para receber apenas o teu pedido real)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
