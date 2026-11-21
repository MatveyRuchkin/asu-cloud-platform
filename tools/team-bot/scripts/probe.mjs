import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const url = process.argv[2];
if (!url?.startsWith('https://'))
  throw new Error('Usage: node scripts/probe.mjs https://YOUR-PROBE.workers.dev');
const file = '.dev.vars.probe';
const secret = existsSync(file)
  ? readFileSync(file, 'utf8').trim()
  : randomBytes(32).toString('hex');
if (!existsSync(file)) writeFileSync(file, secret, { mode: 0o600 });
const child = spawnSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'secret',
    'put',
    'DIAGNOSTIC_SECRET',
    '--config',
    'probe/wrangler.jsonc',
  ],
  { input: secret + '\n', encoding: 'utf8' },
);
if (child.status !== 0) {
  console.error('Secret setup failed. Run wrangler login and try again.');
  process.exit(1);
}
let response;
for (let attempt = 0; attempt < 4; attempt++) {
  response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status !== 403) break;
  await response.body?.cancel();
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
const raw = await response.text();
let data;
try {
  data = JSON.parse(raw);
} catch {
  data = { error: 'probe-response-not-json', token_methods_tested: false };
}
const result = {
  tested_at: new Date().toISOString(),
  worker_url: url,
  http_status: response.status,
  ...data,
};
mkdirSync('evaluation-results', { recursive: true });
writeFileSync('evaluation-results/network-probe.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
