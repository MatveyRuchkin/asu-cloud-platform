import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { secretMatches } from '../src/index';

it('accepts a normalized webhook secret without accepting a wrong secret', async () => {
  expect(await secretMatches('real-secret', '\uFEFFreal-secret\r\n')).toBe(true);
  expect(await secretMatches('wrong', 'real-secret\r\n')).toBe(false);
});

it('removes PowerShell BOM/CRLF before writing a secret to Wrangler stdin', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asu-team-bot-secret-test-'));
  try {
    const fake = join(dir, 'node_modules/wrangler/bin');
    mkdirSync(fake, { recursive: true });
    writeFileSync(
      join(fake, 'wrangler.js'),
      `const fs=require('node:fs');let value='';process.stdin.on('data',c=>value+=c);process.stdin.on('end',()=>fs.writeFileSync('observed.txt',value));`,
    );
    const bridge = fileURLToPath(new URL('../scripts/put-secret.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [bridge, 'TELEGRAM_BOT_TOKEN'], {
      cwd: dir,
      input: '\uFEFF12345:fake-test-value\r\n',
      encoding: 'utf8',
      timeout: 15000,
    });
    expect(result.status).toBe(0);
    expect(readFileSync(join(dir, 'observed.txt'), 'utf8')).toBe('12345:fake-test-value');
    expect(result.stdout).not.toContain('fake-test-value');
  } finally {
    const absolute = resolve(dir),
      prefix = join(resolve(tmpdir()), 'asu-team-bot-secret-test-');
    if (absolute.startsWith(prefix)) rmSync(absolute, { recursive: true, force: true });
  }
});

it('repairs an absent webhook using normalized stored secrets and preserves pending updates', async () => {
  const code = await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
  });
  let registration: unknown;
  const mf = new Miniflare({
    modules: true,
    script: code.outputFiles[0].text,
    compatibilityDate: '2026-07-01',
    d1Databases: ['DB'],
    outboundService: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/bot12345:fake-token/getMe')
        return Response.json({ ok: true, result: { username: 'example_test_bot' } });
      if (url.pathname === '/bot12345:fake-token/setWebhook') {
        registration = await request.json();
        return Response.json({ ok: true, result: true });
      }
      if (url.pathname === '/bot12345:fake-token/getWebhookInfo')
        return Response.json({
          ok: true,
          result: { url: 'https://worker.test/webhook', pending_update_count: 0 },
        });
      return new Response('Unexpected fake request', { status: 500 });
    },
    bindings: {
      TELEGRAM_BOT_TOKEN: '12345:fake-token\r\n',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook\r\n',
      DIAGNOSTIC_SECRET: ' diagnostic\r\n',
    },
  });
  try {
    const response = await mf.dispatchFetch('https://worker.test/diagnostics/telegram', {
      method: 'POST',
      headers: { Authorization: 'Bearer diagnostic', 'Content-Type': 'application/json' },
      body: JSON.stringify({ repair_webhook: true }),
    });
    const result = (await response.json()) as {
      getMe: boolean;
      webhook_repaired: boolean;
      token_had_surrounding_whitespace: boolean;
    };
    expect(registration).toEqual(
      expect.objectContaining({
        url: 'https://worker.test/webhook',
        secret_token: 'test-webhook',
        drop_pending_updates: false,
      }),
    );
    expect({ status: response.status, result }).toEqual(expect.objectContaining({ status: 200 }));
    expect(result.getMe).toBe(true);
    expect(result.webhook_repaired).toBe(true);
    expect(result.token_had_surrounding_whitespace).toBe(true);
  } finally {
    await mf.dispose();
  }
});
