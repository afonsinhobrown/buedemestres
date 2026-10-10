require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Ligado à Base de Dados. A criar 5 provedores teste...');

    const providers = [
      {
        id: '10000000-0000-0000-0000-100000000001',
        name: 'Carlos Canalizador',
        slug: 'carlos-canalizador',
        business_name: 'SOS Pichelaria Maputo',
        headline: 'Canalizador Rápido e Eficaz',
        bio: 'Resolvo fugas de água em 30 minutos.',
        category_id: 4, // Exemplo: Canalizador
        lat: -25.9680,
        lng: 32.5700,
        service: 'Reparação de Roturas'
      },
      {
        id: '20000000-0000-0000-0000-200000000002',
        name: 'Maria Electricista',
        slug: 'maria-eletricista',
        business_name: 'Luz & Energia',
        headline: 'Electricista Certificada',
        bio: 'Instalações eléctricas e quadros de energia.',
        category_id: 5, // Exemplo: Electricista
        lat: -25.9750,
        lng: 32.5850,
        service: 'Instalação de Quadro Eléctrico'
      },
      {
        id: '30000000-0000-0000-0000-300000000003',
        name: 'João Explicador',
        slug: 'joao-explicador',
        business_name: 'Mente Brilhante',
        headline: 'Explicador de Matemática',
        bio: 'Aulas ao domicílio de Matemática e Física para o 12º ano.',
        category_id: 8, // Exemplo: Educação
        lat: -25.9550,
        lng: 32.5900,
        service: 'Explicações de Matemática 12º Ano'
      },
      {
        id: '40000000-0000-0000-0000-400000000004',
        name: 'Ana Limpezas',
        slug: 'ana-limpezas',
        business_name: 'Brilho Total',
        headline: 'Limpeza Profunda de Espaços',
        bio: 'Deixo a sua casa a brilhar. Limpeza pós-obra e regular.',
        category_id: 11, // Exemplo: Limpezas
        lat: -25.9400,
        lng: 32.5950,
        service: 'Limpeza Pós-Obra'
      },
      {
        id: '50000000-0000-0000-0000-500000000005',
        name: 'Marta Designer',
        slug: 'marta-designer',
        business_name: 'Design e Web M',
        headline: 'Criação de Logótipos e Sites',
        bio: 'Faço o seu negócio nascer na internet.',
        category_id: 15, // Exemplo: Design
        lat: -25.9600,
        lng: 32.5800,
        service: 'Criação de Logótipo Profissional'
      }
    ];

    for (const p of providers) {
      // 1. Inserir em profiles
      await client.query(`
        INSERT INTO profiles (id, full_name, role, is_active)
        VALUES ($1, $2, 'provider', true)
        ON CONFLICT (id) DO NOTHING;
      `, [p.id, p.name]);

      // 2. Inserir em provider_profiles
      await client.query(`
        INSERT INTO provider_profiles (profile_id, slug, business_name, headline, bio, primary_category_id, lat, lng, is_published, is_available, verification, rating_avg, rating_count, district_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true, 'approved', 4.5, 10, 1)
        ON CONFLICT (profile_id) DO UPDATE SET is_published = true;
      `, [p.id, p.slug, p.business_name, p.headline, p.bio, p.category_id, p.lat, p.lng]);

      // 3. Inserir um serviço
      await client.query(`
        INSERT INTO provider_services (provider_id, category_id, title, price_min)
        SELECT $1, $2, $3, 1500
        WHERE NOT EXISTS (SELECT 1 FROM provider_services WHERE provider_id = $1);
      `, [p.id, p.category_id, p.service]);
      
      // 4. Actualizar o documento de pesquisa (search_document)
      await client.query(`SELECT refresh_provider_search($1);`, [p.id]);

      // 5. Inserir na presença (para aparecer no radar On-Demand do APK)
      // O raio e categorias são postos na presença para ser logo encontrado
      await client.query(`
        INSERT INTO provider_presence (provider_id, is_online, location, categories, updated_at)
        VALUES ($1, true, ST_SetSRID(ST_MakePoint($2, $3), 4326), ARRAY[$4::int], now() + interval '1 day')
        ON CONFLICT (provider_id) DO UPDATE 
        SET is_online = true, location = ST_SetSRID(ST_MakePoint($2, $3), 4326), categories = ARRAY[$4::int], updated_at = now() + interval '1 day';
      `, [p.id, p.lng, p.lat, p.category_id]);
    }

    console.log('✅ 5 provedores criados com sucesso!');
  } catch (error) {
    console.error('❌ Falha:', error);
  } finally {
    await client.end();
  }
}

main();
