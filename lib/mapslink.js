/**
 * Menggali Place ID dari apa pun yang ditempel pengguna:
 * link pendek maps.app.goo.gl, URL Google Maps lengkap, atau Place ID mentah.
 */

const GOOGLE_HOST = /(^|\.)(google\.[a-z]{2,3}(\.[a-z]{2})?|goo\.gl|g\.page|g\.co)$/i;
const PLACE_ID = /((?:Ch|Gh|Ei|El|Ek|Ea)[A-Za-z0-9_-]{15,})/;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export function isGoogleUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && GOOGLE_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/** Hanya pola yang pasti menandai Place ID — aman dipakai pada URL. */
export function extractPlaceIdStrict(text) {
  if (!text) return null;

  // ?place_id=… / ?placeid=… / place_id:…
  const explicit = text.match(/place_?id[=:]([A-Za-z0-9_-]{15,})/i);
  if (explicit) return explicit[1];

  // Segmen protobuf di URL Maps: !1sChIJ… atau !19sChIJ…
  const embedded = text.match(/![0-9]+s((?:Ch|Gh|Ei|El|Ek|Ea)[A-Za-z0-9_-]{15,})/);
  if (embedded) return embedded[1];

  // "place_id":"ChIJ…" di dalam HTML
  const quoted = text.match(/"place_?id"\s*:\s*"([A-Za-z0-9_-]{15,})"/i);
  return quoted ? quoted[1] : null;
}

/** Longgar: terima juga Place ID yang berdiri sendiri di tengah teks. */
export function extractPlaceId(text) {
  if (!text) return null;
  const strict = extractPlaceIdStrict(text);
  if (strict) return strict;
  const bare = text.match(PLACE_ID);
  return bare ? bare[1] : null;
}

/** CID adalah 8 byte terakhir dari ftid heksadesimal (0x…:0xCID). */
export function extractCid(text) {
  if (!text) return null;
  const direct = text.match(/[?&#]cid=(\d{5,25})/);
  if (direct) return direct[1];

  const ftid = text.match(/0x[0-9a-f]+:0x([0-9a-f]{6,20})/i);
  if (ftid) {
    try { return BigInt(`0x${ftid[1]}`).toString(10); } catch { return null; }
  }
  return null;
}

/** Nama usaha yang terselip di path /maps/place/<Nama>/… */
export function nameFromUrl(value) {
  const match = String(value).match(/\/maps\/place\/([^/@?]+)/);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
  } catch {
    return match[1].replace(/\+/g, ' ').trim();
  }
}

/** Ikuti rantai redirect tanpa mengunduh body — cukup baca header Location. */
export async function followRedirects(startUrl, maxHops = 6) {
  let current = startUrl;

  for (let hop = 0; hop < maxHops; hop += 1) {
    if (!isGoogleUrl(current)) break;

    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9' },
    });

    const location = res.headers.get('location');
    if (!location || res.status < 300 || res.status >= 400) return current;

    const next = new URL(location, current).toString();
    if (next === current) return current;
    current = next;
  }

  return current;
}

/** Upaya terakhir: baca HTML halaman Maps dan cari Place ID di dalamnya. */
export async function scrapePlaceId(url) {
  if (!isGoogleUrl(url)) return null;

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9' },
  });
  if (!res.ok) return null;

  const html = (await res.text()).slice(0, 900_000);
  return extractPlaceId(html);
}
