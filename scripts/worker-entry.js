/**
 * Titik masuk Pages "advanced mode" (_worker.js).
 * Dipakai untuk Direct Upload lewat dashboard Cloudflare, yang tidak
 * mengompilasi folder functions/ sendiri. Logikanya sama persis —
 * handler yang sama di-import ulang, bukan disalin.
 */
import * as status from '../functions/api/status.js';
import * as search from '../functions/api/search.js';
import * as place from '../functions/api/place.js';
import * as resolve from '../functions/api/resolve.js';

const ROUTES = {
  '/api/status': status,
  '/api/search': search,
  '/api/place': place,
  '/api/resolve': resolve,
};

function apiError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    // Skrip worker sendiri bukan aset; jangan diteruskan ke ASSETS.
    if (pathname === '/_worker.js') return new Response('Not Found', { status: 404 });

    const route = ROUTES[pathname];

    if (route) {
      const handler = request.method === 'POST' ? route.onRequestPost : route.onRequestGet;
      if (!handler) return apiError('Metode tidak didukung.', 405);
      return handler({ request, env, ctx });
    }

    // Endpoint API yang tidak dikenal harus balas JSON 404, bukan halaman HTML.
    if (pathname.startsWith('/api/')) return apiError('Endpoint tidak ditemukan.', 404);

    return env.ASSETS.fetch(request);
  },
};
