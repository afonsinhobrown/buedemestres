require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Ligado à DB. A forçar aprovação de mestres...');

    // 1. Forçar todos os perfis Pro a ficarem verificados e publicados
    await client.query(`
      UPDATE provider_profiles 
      SET verification = 'approved', is_published = true, is_available = true;
    `);

    // 2. Colocar todas as categorias possíveis e uma localização central em Maputo para todos os que estão online
    await client.query(`
      UPDATE provider_presence 
      SET categories = '{1,2,3,4,5,6,7,8,9,10}',
          location = ST_SetSRID(ST_MakePoint(32.5833, -25.9666), 4326);
    `);

    console.log('Mestres aprovados e visíveis!');
  } catch (error) {
    console.error('Falha:', error);
  } finally {
    await client.end();
  }
}

main();
