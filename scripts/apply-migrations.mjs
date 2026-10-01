#!/usr/bin/env node
/**
 * apply-migrations.mjs
 * Aplica todas as migrations na base de dados Neon em ordem.
 * Uso: node scripts/apply-migrations.mjs
 */
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌  Variável DATABASE_URL não definida.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log('✅  Ligado à base de dados Neon.\n');

  // Criar tabela de controlo de migrations se não existir
  await client.query(`
    create table if not exists _migrations (
      id serial primary key,
      filename text not null unique,
      applied_at timestamptz not null default now()
    )
  `);

  const migrationsDir = join(__dirname, '..', 'migrations');
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await client.query(
      'select 1 from _migrations where filename = $1',
      [file]
    );
    if (rows.length > 0) {
      console.log(`⏭   ${file} — já aplicada`);
      continue;
    }

    console.log(`⚙️   Aplicar ${file}...`);
    const sql = await readFile(join(migrationsDir, file), 'utf-8');

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'insert into _migrations(filename) values($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`✅  ${file} — OK`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌  ${file} — ERRO:`);
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log('\n🎉  Todas as migrations aplicadas com sucesso!');
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
