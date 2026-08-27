export const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function fail(message, { status = 400, code } = {}) {
  return json({ error: message, code }, status);
}

/** Key server (rahasia) lebih diutamakan; kalau tidak ada, pakai key milik pengunjung. */
export function placesKey(request, env) {
  const own = request.headers.get('X-Places-Key');
  return (env && env.GOOGLE_MAPS_API_KEY) || (own && own.trim()) || null;
}

export function noKey() {
  return fail('Google Places API key belum dipasang.', { status: 400, code: 'NO_KEY' });
}
