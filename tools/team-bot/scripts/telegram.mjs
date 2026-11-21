// Tokens are read from environment, never passed as CLI args or printed.
const action = process.argv[2],
  base = process.env.WORKER_URL,
  token = process.env.TELEGRAM_BOT_TOKEN;
if (!token)
  throw new Error('Set TELEGRAM_BOT_TOKEN locally; never paste tokens into chat or commit them.');
const api = async (method, body = {}) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!data.ok) {
      console.error(`Telegram ${method} failed (${data.error_code || response.status}).`);
      process.exit(1);
    }
    return data.result;
  } catch {
    console.error('Telegram network request failed.');
    process.exit(1);
  }
};
if (action === 'set-webhook') {
  if (!base?.startsWith('https://') || !process.env.TELEGRAM_WEBHOOK_SECRET)
    throw new Error('Set WORKER_URL and TELEGRAM_WEBHOOK_SECRET.');
  await api('setWebhook', {
    url: new URL('/webhook', base).href,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
    max_connections: 2,
  });
  console.log('Webhook registered. Pending updates preserved.');
} else if (action === 'info') {
  const data = await api('getWebhookInfo');
  console.log(
    JSON.stringify(
      {
        url: data.url,
        pending_update_count: data.pending_update_count,
        last_error_date: data.last_error_date,
        has_error: !!data.last_error_message,
      },
      null,
      2,
    ),
  );
} else if (action === 'get-me') {
  await api('getMe');
  console.log('getMe from this computer passed; Worker test is separate.');
} else if (action === 'delete-webhook') {
  await api('deleteWebhook', { drop_pending_updates: false });
  console.log('Webhook removed, pending updates preserved.');
} else throw new Error('Actions: set-webhook, info, get-me, delete-webhook');
