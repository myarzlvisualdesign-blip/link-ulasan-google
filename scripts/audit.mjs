import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import {
  extractCid,
  extractPlaceId,
  extractPlaceIdStrict,
  isGoogleUrl,
  nameFromUrl,
} from '../lib/mapslink.js';

const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
const reviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`;
const mapsUrl = `https://www.google.com/maps/place/Sydney+Opera+House/data=!4m2!3m1!1s${placeId}`;

assert.equal(extractPlaceId(placeId), placeId, 'Place ID mentah harus dikenali');
assert.equal(extractPlaceIdStrict(`https://google.com/maps?place_id=${placeId}`), placeId);
assert.equal(extractPlaceIdStrict(mapsUrl), placeId, 'Place ID protobuf harus dikenali');
assert.equal(nameFromUrl(mapsUrl), 'Sydney Opera House');
assert.equal(extractCid('https://maps.google.com/?cid=123456789012345'), '123456789012345');
assert.equal(isGoogleUrl('https://maps.google.com/maps'), true);
assert.equal(isGoogleUrl('https://google.com.evil.example/maps'), false);
assert.equal(extractPlaceIdStrict('https://example.com/ChIJNotTrusted123456789'), null);

const pngBuffer = await QRCode.toBuffer(reviewUrl, {
  type: 'png',
  width: 1200,
  margin: 4,
  errorCorrectionLevel: 'M',
  color: { dark: '#101010', light: '#ffffff' },
});
const png = PNG.sync.read(pngBuffer);
const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

assert.ok(decoded, 'QR PNG harus dapat dibaca kembali oleh decoder');
assert.equal(decoded.data, reviewUrl, 'Isi QR harus persis sama dengan link ulasan');
assert.equal(png.width, 1200, 'PNG unduhan harus beresolusi 1200px');
assert.equal(png.height, 1200, 'PNG unduhan harus persegi');

console.log(JSON.stringify({
  parser: 'lulus',
  qrDecode: 'lulus',
  qrPixels: `${png.width}x${png.height}`,
  qrTarget: decoded.data,
}, null, 2));
