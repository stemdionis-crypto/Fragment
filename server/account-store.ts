import { Pool } from 'pg';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// One authoritative snapshot, with compare-and-swap to reject overlapping servers.
// A successful profile response must follow a committed durable write.
export async function openAccountStore(file: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if ((process.env.RENDER || process.env.FRAGMENT_REQUIRE_DATABASE === 'true') && process.env.FRAGMENT_ALLOW_EPHEMERAL_STORAGE !== 'true') {
      throw new Error('DATABASE_URL is required on Render; refusing temporary account storage');
    }
    return {
      durable: false,
      load: async (): Promise<unknown[]> => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [],
      save: async (data: unknown[]) => {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file + '.tmp', JSON.stringify(data), { mode: 0o600 });
        renameSync(file + '.tmp', file);
      },
      close: async () => {},
    };
  }
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10_000, query_timeout: 10_000, max: 2 });
  await pool.query(`CREATE TABLE IF NOT EXISTS fragment_account_state (
    id smallint PRIMARY KEY CHECK (id = 1), revision bigint NOT NULL DEFAULT 0,
    accounts jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query('INSERT INTO fragment_account_state (id) VALUES (1) ON CONFLICT DO NOTHING');
  let revision = '';
  return {
    durable: true,
    load: async (): Promise<unknown[]> => {
      const result = await pool.query('SELECT revision::text, accounts FROM fragment_account_state WHERE id = 1');
      revision = result.rows[0].revision;
      const accounts = result.rows[0].accounts;
      // Import a local legacy file only into a genuinely empty database.
      if (revision === '0' && !accounts.length && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
      return accounts;
    },
    save: async (accounts: unknown[]) => {
      const result = await pool.query(`UPDATE fragment_account_state SET accounts = $1::jsonb,
        revision = revision + 1, updated_at = now() WHERE id = 1 AND revision = $2::bigint RETURNING revision::text`,
      [JSON.stringify(accounts), revision]);
      if (!result.rowCount) throw new Error('Account storage changed on another server; retry after reconnecting');
      revision = result.rows[0].revision;
    },
    close: () => pool.end(),
  };
}
