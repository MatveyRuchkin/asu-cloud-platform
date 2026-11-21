import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const path = '.dev.vars.diagnostic';
const value = existsSync(path)
  ? readFileSync(path, 'utf8').trim()
  : randomBytes(32).toString('hex');
if (!existsSync(path)) writeFileSync(path, value, { mode: 0o600 });
const result = spawnSync(
  process.execPath,
  ['node_modules/wrangler/bin/wrangler.js', 'secret', 'put', 'DIAGNOSTIC_SECRET'],
  { input: value + '\n', encoding: 'utf8' },
);
if (result.status !== 0) {
  console.error('Diagnostic secret setup failed.');
  process.exit(1);
}
console.log('Diagnostic Cloudflare Secret configured. Value was not printed.');
