/**
 * Pembungkus tipis Places API (New).
 * Dokumentasi: https://developers.google.com/maps/documentation/places/web-service
 */

const BASE = 'https://places.googleapis.com/v1';
const LANGUAGE = 'id';
const REGION = 'ID';

async function call(url, key, { method = 'GET', body, fieldMask } = {}) {
  const headers = { 'X-Goog-Api-Key': key };
  if (fieldMask) headers['X-Goog-FieldMask'] = fieldMask;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = (data.error && data.error.message) || `HTTP ${res.status}`;
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Saran nama usaha sambil mengetik. SKU paling murah di Places API. */
export async function autocomplete(key, input) {
  const data = await call(`${BASE}/places:autocomplete`, key, {
    method: 'POST',
    body: { input, languageCode: LANGUAGE, regionCode: REGION },
  });

  return (data.suggestions || [])
    .map((suggestion) => suggestion.placePrediction)
    .filter(Boolean)
    .map((prediction) => {
      const format = prediction.structuredFormat || {};
      return {
        placeId: prediction.placeId || String(prediction.place || '').replace('places/', ''),
        main: (format.mainText && format.mainText.text) || (prediction.text && prediction.text.text) || '',
        secondary: (format.secondaryText && format.secondaryText.text) || '',
      };
    })
    .filter((item) => item.placeId && item.main);
}

/** Detail satu tempat untuk kartu konfirmasi. */
export async function details(key, placeId) {
  const data = await call(
    `${BASE}/places/${encodeURIComponent(placeId)}?languageCode=${LANGUAGE}&regionCode=${REGION}`,
    key,
    { fieldMask: 'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri' },
  );

  return {
    id: data.id || placeId,
    name: (data.displayName && data.displayName.text) || '',
    address: data.formattedAddress || '',
    rating: typeof data.rating === 'number' ? data.rating : null,
    ratingCount: typeof data.userRatingCount === 'number' ? data.userRatingCount : null,
    mapsUri: data.googleMapsUri || '',
  };
}

/** Pencarian teks — dipakai sebagai jaring pengaman saat link tidak bisa diurai. */
export async function textSearch(key, textQuery) {
  const data = await call(`${BASE}/places:searchText`, key, {
    method: 'POST',
    body: { textQuery, languageCode: LANGUAGE, regionCode: REGION, maxResultCount: 5 },
    fieldMask: 'places.id,places.displayName,places.formattedAddress',
  });

  return (data.places || []).map((place) => ({
    placeId: place.id,
    main: (place.displayName && place.displayName.text) || '',
    secondary: place.formattedAddress || '',
  }));
}
