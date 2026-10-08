import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for db:migrate');

const migrations = fileURLToPath(new URL('../migrations/', import.meta.url));
const files = readdirSync(migrations).filter(name => /^\d+_[\w-]+\.sql$/.test(name)).sort();
const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });

try {
  await client.connect();
  for (const file of files) {
    const version = Number(file.split('_', 1)[0]);
    const installed = await client.query<{ present: boolean }>(
      `SELECT to_regclass('public.fragment_schema_migrations') IS NOT NULL AS present`,
    );
    if (installed.rows[0]?.present) {
      const applied = await client.query('SELECT 1 FROM fragment_schema_migrations WHERE version = $1', [version]);
      if (applied.rowCount) { console.log(`Already applied: ${file}`); continue; }
    }
    await client.query(readFileSync(join(migrations, file), 'utf8'));
    console.log(`Applied: ${file}`);
  }
} finally {
  await client.end();
}
