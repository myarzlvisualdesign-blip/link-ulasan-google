import { json, fail, placesKey } from '../../lib/http.js';
import { textSearch } from '../../lib/places.js';
import {
  extractPlaceId, extractCid, nameFromUrl,
  followRedirects, scrapePlaceId, isGoogleUrl,
} from '../../lib/mapslink.js';

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch { /* biarkan kosong */ }

  const input = String(body.input || '').trim();
  if (!input) return fail('Tempel dulu link Google Maps atau Place ID Anda.');
  if (input.length > 2048) return fail('Input terlalu panjang.');

  // 1. Place ID mentah atau tertulis jelas di dalam teks.
  const direct = extractPlaceId(input);
  if (direct && !isGoogleUrl(input)) return json({ placeId: direct, name: '', address: '' });

  if (!isGoogleUrl(input)) {
    if (direct) return json({ placeId: direct });
    return fail('Itu bukan link Google Maps. Salin lewat tombol Bagikan di Google Maps.');
  }

  let finalUrl = input;
  try {
    finalUrl = await followRedirects(input);
  } catch { /* link pendek gagal dibuka; lanjut pakai URL asli */ }

  const name = nameFromUrl(finalUrl) || nameFromUrl(input);

  // 2. Place ID biasanya sudah ada di URL panjang hasil redirect.
  const fromUrl = extractPlaceId(finalUrl);
  if (fromUrl) return json({ placeId: fromUrl, name });

  // 3. Kalau hanya ada CID, buka halaman CID-nya dan cari Place ID di HTML.
  const cid = extractCid(finalUrl);
  const pages = cid ? [`https://www.google.com/maps?cid=${cid}`, finalUrl] : [finalUrl];

  for (const page of pages) {
    try {
      const scraped = await scrapePlaceId(page);
      if (scraped) return json({ placeId: scraped, name });
    } catch { /* coba halaman berikutnya */ }
  }

  // 4. Jaring pengaman terakhir: cari nama usahanya lewat Places API.
  const key = placesKey(request, env);
  if (key && name) {
    try {
      const hits = await textSearch(key, name);
      if (hits.length) {
        return json({
          placeId: hits[0].placeId,
          name: hits[0].main,
          address: hits[0].secondary,
          warning: 'Place ID diambil dari hasil pencarian nama usaha. ' +
            'Cek dulu nama dan alamatnya sebelum dipakai.',
        });
      }
    } catch { /* menyerah dengan sopan di bawah */ }
  }

  return fail(
    'Place ID tidak ketemu di link itu. Coba salin ulang lewat Google Maps: ' +
    'buka usaha Anda, tekan Bagikan, lalu Salin tautan.',
    { status: 422 },
  );
}
