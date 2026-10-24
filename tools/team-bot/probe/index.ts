interface ProbeEnv {
  DIAGNOSTIC_SECRET: string;
}
export default {
  async fetch(request: Request, env: ProbeEnv): Promise<Response> {
    if (
      !env.DIAGNOSTIC_SECRET ||
      request.headers.get('Authorization') !== `Bearer ${env.DIAGNOSTIC_SECRET}`
    )
      return new Response('Forbidden', { status: 403 });
    try {
      const started = Date.now();
      const response = await fetch('https://api.telegram.org/', {
        signal: AbortSignal.timeout(10000),
        redirect: 'manual',
      });
      await response.body?.cancel();
      return Response.json({
        location: 'deployed-cloudflare-worker',
        telegram_http_status: response.status,
        elapsed_ms: Date.now() - started,
        token_methods_tested: false,
        note: 'HTTP-ответ не подтверждает getMe/sendMessage. Выполните проверку основного бота после настройки Secrets.',
      });
    } catch {
      return Response.json(
        { location: 'deployed-cloudflare-worker', reachable: false, token_methods_tested: false },
        { status: 502 },
      );
    }
  },
};
