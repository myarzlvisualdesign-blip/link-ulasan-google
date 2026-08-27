import { json, fail, noKey, placesKey } from '../../lib/http.js';
import { autocomplete } from '../../lib/places.js';

export async function onRequestGet({ request, env }) {
  const query = (new URL(request.url).searchParams.get('q') || '').trim();
  if (query.length < 3) return json({ results: [] });
  if (query.length > 200) return fail('Kata kunci terlalu panjang.');

  const key = placesKey(request, env);
  if (!key) return noKey();

  try {
    return json({ results: await autocomplete(key, query) });
  } catch (error) {
    return fail(`Google menolak permintaan: ${error.message}`, { status: error.status || 502 });
  }
}
