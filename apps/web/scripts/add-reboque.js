require('dotenv').config({ path: '../../.env.local' });
const { Client } = require('pg');

async function addCategory() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('Adding Reboque category...');

  await client.query(`
    INSERT INTO categories (parent_id, slug, name, sort_order)
    SELECT id, 'reboque', 'Reboque', 6
    FROM categories
    WHERE slug = 'automovel'
    ON CONFLICT (slug) DO NOTHING;
  `);

  console.log('Category Reboque added successfully.');
  await client.end();
}

addCategory();
