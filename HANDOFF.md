# Serah terima

Kode di repo ini **sudah selesai dan teruji**. Yang tersisa hanya mendorongnya
ke GitHub dan menghubungkannya ke Cloudflare Pages.

## Yang sudah beres

- UI + backend lengkap, teruji di Chromium (QR didekode ulang, poster 1 halaman A4,
  nol overflow di 390 px, nol error konsol).
- 3 commit siap dorong, branch `main`.
- `npm run build` menghasilkan `dist/` siap Direct Upload ke Cloudflare Pages.

## Langkah yang tersisa

```bash
# 1. Buat repo kosong di GitHub (nama bebas, misal link-ulasan-google),
#    JANGAN centang README/gitignore/license.

# 2. Dorong kode ini:
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Lalu di Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**,
pilih repo ini, **build command dikosongkan**, **output directory: `public`**.
Folder `functions/` otomatis dikenali sebagai Pages Functions.

Alternatif tanpa GitHub: `npm run build`, lalu unggah isi folder `dist/`
lewat **Pages → Upload assets** di dashboard.

## Opsional: aktifkan pencarian nama usaha

Tanpa ini situs tetap berfungsi penuh lewat mode tempel link.

```bash
npx wrangler pages secret put GOOGLE_MAPS_API_KEY
```

Aktifkan **Places API (New)** di Google Cloud Console, batasi key ke API itu saja,
dan pasang batas kuota harian. Karena key dipakai dari sisi server, pembatasan
berdasarkan HTTP referrer tidak berlaku.

## Jangan diubah tanpa alasan

- `public/vendor/qrcode.min.js` — bundel hasil `npm run build:vendor`, jangan diedit tangan.
- `lib/mapslink.js` — regex Place ID sudah diuji terhadap 6 bentuk URL Google Maps.
- Blok `@media print` di `app.css` — menjaga poster tetap tepat 1 halaman A4.
