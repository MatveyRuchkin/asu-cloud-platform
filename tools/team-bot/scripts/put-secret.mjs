import { spawnSync } from 'node:child_process';
const name = process.argv[2];
if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(name || '')) process.exit(1);
let input = '';
for await (const chunk of process.stdin) input += chunk.toString('utf8');
// PowerShell pipelines may append CRLF/BOM. Send exactly the entered value to Wrangler.
const value = input.trim();
if (!value) {
  console.error('Empty secret; nothing was changed.');
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  ['node_modules/wrangler/bin/wrangler.js', 'secret', 'put', name],
  { input: value, encoding: 'utf8' },
);
if (result.status !== 0) {
  console.error(`Secret setup failed: ${name}`);
  process.exit(1);
}
console.log(`Secret configured: ${name}`);
