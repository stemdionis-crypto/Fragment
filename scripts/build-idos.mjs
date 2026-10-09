import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'client', 'dist-idos');
const releases = join(root, 'releases');
const server = process.env.FRAGMENT_RELEASE_SERVER || 'wss://fragment-demo.onrender.com';
if (!server.startsWith('wss://')) throw new Error('Release server must use wss://');
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed (${result.status}): ${command}`);
}
for (const project of ['server', 'client']) {
  run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', project, '--noEmit']);
}
run(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'client/vite.config.ts', '--base', './', '--outDir', 'dist-idos'], {
  ...process.env, VITE_SERVER_URL: server, VITE_DEMO_MODE: 'false',
});
if (!existsSync(join(dist, 'index.html'))) throw new Error('Build is missing index.html');
mkdirSync(releases, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const zip = join(releases, `Fragment-${stamp}.zip`);
if (process.platform === 'win32') {
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; $archive = [System.IO.Compression.ZipFile]::Open($env:FRAGMENT_ZIP_PATH, 'Create'); try { Get-ChildItem -LiteralPath $env:FRAGMENT_DIST_PATH -Recurse -File | ForEach-Object { $entry = $_.FullName.Substring($env:FRAGMENT_DIST_PATH.Length + 1).Replace([char]92, [char]47); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entry) | Out-Null } } finally { $archive.Dispose() }"], {
    ...process.env, FRAGMENT_DIST_PATH: dist, FRAGMENT_ZIP_PATH: zip,
  });
} else {
  const result = spawnSync('zip', ['-r', zip, '.'], { cwd: dist, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw result.error || new Error('zip failed');
}
const manifest = { title_id: '49HLIN0J', created_at: new Date().toISOString(), server, zip,
  sha256: createHash('sha256').update(readFileSync(zip)).digest('hex') };
writeFileSync(join(releases, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nReady for free MCP upload:\n${zip}\nTitle: ${manifest.title_id}`);
