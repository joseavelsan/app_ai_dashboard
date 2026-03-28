/**
 * Cloudflare Worker — proxy para API de Anthropic
 *
 * DESPLIEGUE:
 * 1. dash.cloudflare.com → Workers & Pages → Create → Create Worker
 * 2. Pega este código y guarda (nombre sugerido: claude-proxy)
 * 3. Settings → Variables → Secrets → Add secret
 *    Nombre: ANTHROPIC_API_KEY  |  Valor: sk-ant-api03-...
 * 4. Copia la URL del Worker (ej: https://claude-proxy.TU-USUARIO.workers.dev)
 * 5. Pégala en ⚙ API del dashboard AI Stack
 */

export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY secret not set in Worker' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const body = await request.json();

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await resp.json();

      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: { message: e.message } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
