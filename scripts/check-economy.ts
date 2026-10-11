import { spawnSync } from 'node:child_process';
// Each regression runs in its own process and isolated temporary data directory.
// Practice no longer mints Signals; use the current human-match economy tests.
for (const test of ['check-accounts.ts','check-signals.ts','check-cosmetics.ts']) {
  const result = spawnSync(process.execPath,['--import','tsx','scripts/'+test],{stdio:'inherit',timeout:30_000});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
