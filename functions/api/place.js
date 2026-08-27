import { json, fail, noKey, placesKey } from '../../lib/http.js';
import { details } from '../../lib/places.js';

export async function onRequestGet({ request, env }) {
  const placeId = (new URL(request.url).searchParams.get('id') || '').trim();
  if (!/^[A-Za-z0-9_-]{10,255}$/.test(placeId)) return fail('Place ID tidak valid.');

  const key = placesKey(request, env);
  if (!key) return noKey();

  try {
    return json(await details(key, placeId));
  } catch (error) {
    return fail(`Google menolak permintaan: ${error.message}`, { status: error.status || 502 });
  }
}
