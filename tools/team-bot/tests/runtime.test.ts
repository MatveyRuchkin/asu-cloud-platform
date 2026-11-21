import { build } from 'esbuild';
import { Miniflare, createFetchMock } from 'miniflare';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { it, expect } from 'vitest';

const schema = readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
async function migrate(mf: Miniflare) {
  const db = await mf.getD1Database('DB');
  for (const sql of schema
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(sql).run();
  return db;
}
it('runs native fetch clients inside the actual Worker runtime', async () => {
  const compiled = await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
  });
  const mocked = createFetchMock();
  mocked.disableNetConnect();
  const group = mocked.get('https://api.github.com');
  const member = {
    slug: 'student',
    name: 'Участник Примеров',
    role: 'Разработчик',
    department: 'Примеры',
    code: 'TEST-17',
    lead_slug: null,
    issue_number: 17,
    task: 'Проверить пример',
    deliverable: 'example',
    steps: ['Проверить', 'Записать'],
    depends: 'Примеры',
  };
  const issue = {
    number: 17,
    title: 'Example',
    state: 'open',
    body: 'Test',
    html_url: 'https://github.com/test/repo/issues/17',
    updated_at: '2026-10-24T00:00:00Z',
  };
  const json = (value: unknown) => ({
    statusCode: 200,
    data: JSON.stringify(value),
    responseOptions: { headers: { 'Content-Type': 'application/json' } },
  });
  group.intercept({ path: '/repos/test/repo/contents/site/team.json?ref=dev' }).reply(() =>
    json({
      encoding: 'base64',
      content: Buffer.from(JSON.stringify({ members: [member], groups: [] })).toString('base64'),
    }),
  );
  group.intercept({ path: /^\/repos\/test\/repo\/issues\/17\??$/ }).reply(() => json(issue));
  group
    .intercept({ path: '/repos/test/repo/issues/17/timeline?per_page=100&page=1' })
    .reply(() => json([]));
  group
    .intercept({
      path: '/repos/test/repo/pulls?state=all&sort=updated&direction=desc&per_page=100&page=1',
    })
    .reply(() => json([]));
  group
    .intercept({ path: '/repos/test/repo/contents/docs/tasks/TEST-17.md?ref=dev' })
    .reply(() =>
      json({ encoding: 'base64', content: Buffer.from('Описание задания').toString('base64') }),
    );
  const mf = new Miniflare({
    modules: true,
    script: compiled.outputFiles[0].text,
    compatibilityDate: '2026-07-01',
    d1Databases: ['DB'],
    bindings: { DIAGNOSTIC_SECRET: 'runtime-test', GITHUB_REPOSITORY: 'test/repo' },
    fetchMock: mocked,
  });
  try {
    await migrate(mf);
    const response = await mf.dispatchFetch('https://worker.test/diagnostics/ai', {
      method: 'POST',
      headers: { Authorization: 'Bearer runtime-test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: 17, question: 'Какой следующий шаг?' }),
    });
    const result = (await response.json()) as { stage: string; error: string };
    // No model in this test: reaching this stage proves real Worker fetch, GitHub parsing and D1 cache work.
    expect(result).toEqual(expect.objectContaining({ stage: 'workers-ai' }));
    expect(result.error).toContain('binding');
  } finally {
    await mf.dispose();
    await mocked.close();
  }
});

it('keeps D1 registrations after stopping and starting workerd', async () => {
  const path = mkdtempSync(join(tmpdir(), 'asu-team-bot-persist-'));
  const options = {
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    compatibilityDate: '2026-07-01',
    d1Databases: ['DB'],
    d1Persist: path,
  };
  let mf = new Miniflare(options);
  try {
    const db = await migrate(mf);
    await db
      .prepare(
        "INSERT INTO users(telegram_id,slug,status,created,updated) VALUES(42,'test','approved',1,1)",
      )
      .run();
    await mf.dispose();
    mf = new Miniflare(options);
    const restored = await mf.getD1Database('DB');
    expect(
      await restored.prepare('SELECT slug FROM users WHERE telegram_id=42').first('slug'),
    ).toBe('test');
  } finally {
    await mf.dispose();
    const absolute = resolve(path),
      parent = resolve(tmpdir());
    if (
      absolute.startsWith(parent + '\\asu-team-bot-persist-') ||
      absolute.startsWith(parent + '/asu-team-bot-persist-')
    )
      rmSync(absolute, { recursive: true, force: true });
  }
});
