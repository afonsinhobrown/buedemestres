require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Ligado à Base de Dados!');

    console.log('A activar o Realtime para a tabela service_requests...');
    
    // Ignoramos erros caso a tabela já esteja na publicação e adicionamos
    try {
      await client.query('alter publication supabase_realtime drop table if exists service_requests;');
    } catch (e) {}

    await client.query('alter publication supabase_realtime add table service_requests;');
    
    console.log('Realtime activado com sucesso!');
  } catch (error) {
    console.error('Falha:', error);
  } finally {
    await client.end();
  }
}

main();
