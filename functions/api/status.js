import { json } from '../../lib/http.js';

export function onRequestGet({ env, request }) {
  const serverKey = Boolean(env && env.GOOGLE_MAPS_API_KEY);
  const ownKey = Boolean(request.headers.get('X-Places-Key'));
  return json({ searchAvailable: serverKey || ownKey, serverKey });
}
