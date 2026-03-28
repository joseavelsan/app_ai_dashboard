/**
 * Cloudflare Worker — proxy para API de Anthropic
 * Formato: Service Worker (compatible con editor del navegador de Cloudflare)
 *
 * DESPLIEGUE:
 * 1. dash.cloudflare.com → Workers & Pages → Create → Hello World Worker
 * 2. Borra el código de ejemplo y pega este completo → Deploy
 * 3. Settings → Variables and Secrets → Add variable
 *    Tipo: Secret | Nombre: ANTHROPIC_API_KEY | Valor: sk-ant-api03-...
 * 4. Copia la URL del Worker (ej: https://claude-proxy.TU-USUARIO.workers.dev)
 * 5. En AI Stack → ⚙ API → pega la URL → Guardar
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {

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
    return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // En Service Worker format, los secrets son variables globales
  if (typeof ANTHROPIC_API_KEY === 'undefined') {
    return new Response(JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY secret not set in Worker settings' } }), {
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
        'x-api-key': ANTHROPIC_API_KEY,
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
}
