#!/usr/bin/env node
/**
 * apply-new-migrations.mjs
 *
 * Aplica apenas as migrações a partir de 0254. O runner antigo tentava
 * reaplicar 0001–0230 porque _migrations só tem 12 registos.
 *
 * Uso:
 *   node scripts/apply-new-migrations.mjs
 *   node scripts/apply-new-migrations.mjs --dry-run
 */
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const envPath = join(root, '.env.local');
if (existsSync(envPath)) dotenv.config({ path: envPath });
dotenv.config({ path: join(root, '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida.');
  process.exit(1);
}

const START_AT = '0254';
const dryRun = process.argv.includes('--dry-run');
const client = new pg.Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log('Ligado à base de dados.');

  await client.query(`
    create table if not exists _migrations (
      id serial primary key,
      filename text not null unique,
      applied_at timestamptz not null default now()
    )
  `);

  const dir = join(root, 'migrations');
  const files = (await readdir(dir))
    .filter((file) => file.endsWith('.sql') && file >= START_AT)
    .sort();

  const applied = new Set(
    (
      await client.query('select filename from _migrations')
    ).rows.map((row) => row.filename)
  );

  const pending = files.filter((file) => !applied.has(file));
  if (pending.length === 0) {
    console.log('Nada a aplicar.');
    await client.end();
    return;
  }

  console.log('A aplicar:');
  for (const file of pending) console.log(`  - ${file}`);

  if (dryRun) {
    console.log('Dry-run: nada foi alterado.');
    await client.end();
    return;
  }

  try {
    await client.query('begin');

    for (const file of pending) {
      const sql = await readFile(join(dir, file), 'utf-8');
      await client.query(sql);
      await client.query('insert into _migrations(filename) values ($1)', [file]);
      console.log(`✅ ${file}`);
    }

    await client.query('commit');
    console.log('Migrações aplicadas com sucesso.');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    console.error('❌ Falha — rollback feito.');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
