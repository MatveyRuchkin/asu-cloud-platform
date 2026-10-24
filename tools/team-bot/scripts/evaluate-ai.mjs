import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base = process.env.WORKER_URL,
  secret =
    process.env.DIAGNOSTIC_SECRET ||
    (existsSync('.dev.vars.diagnostic') ? readFileSync('.dev.vars.diagnostic', 'utf8').trim() : '');
if (!base || !secret) throw new Error('Set WORKER_URL and DIAGNOSTIC_SECRET.');
const cases = [
  {
    issue: 17,
    question: 'Я не могу сделать Docker, потому что Косачёв не отвечает. Что мне делать?',
  },
  {
    issue: 9,
    question: 'Жду Backend, без него не могу продолжать. Что известно, а что нужно уточнить?',
  },
  { issue: 13, question: 'Какие шаги по моей задаче и что требует согласования? Дай ссылки.' },
];
const results = [];
for (const c of cases) {
  const response = await fetch(new URL('/diagnostics/ai', base), {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
    signal: AbortSignal.timeout(60000),
  });
  results.push({ ...c, http_status: response.status, result: await response.json() });
}
mkdirSync('evaluation-results', { recursive: true });
writeFileSync(
  'evaluation-results/ai-evaluation.json',
  JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
);
console.log(
  'Saved evaluation-results/ai-evaluation.json. Review Russian clarity, factual accuracy, sources and next steps. This script does not declare model quality successful.',
);
