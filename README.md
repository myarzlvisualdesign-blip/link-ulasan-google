# Generator Link Ulasan Google + QR Code

Alat gratis untuk pemilik usaha: cari nama usaha Anda, langsung dapat **link ulasan Google**
(yang membuka form bintang 5), **QR code**, dan **poster A4 siap cetak**.

Serupa dengan Google Review Link Generator milik Whitespark, tapi berbahasa Indonesia,
punya poster cetak, dan berjalan di Cloudflare Pages.

## Apa yang dihasilkan

| Keluaran | Contoh |
| --- | --- |
| Link tulis ulasan | `https://search.google.com/local/writereview?placeid=ChIJ…` |
| Link profil & semua ulasan | `https://www.google.com/maps/place/?q=place_id:ChIJ…` |
| Place ID | `ChIJ…` |
| QR code | PNG 1024px / 2048px, SVG, warna & latar bisa diatur |
| Poster | A4, teks bisa diubah, cetak langsung atau simpan PDF |

## Dua cara menemukan usaha

1. **Cari nama usaha** — autocomplete via Google Places API. Butuh API key
   (dipasang pemilik situs sebagai secret, atau dipasang pengunjung sendiri lewat tombol *API Key*;
   key pengunjung hanya disimpan di `localStorage` browser mereka).
2. **Tempel link Google Maps** — tidak butuh key sama sekali. Menerima:
   - link pendek `https://maps.app.goo.gl/…` (redirect diikuti di server),
   - URL Google Maps lengkap (Place ID digali dari parameter `data=` / `place_id=`),
   - `?cid=` atau `ftid` heksadesimal,
   - Place ID mentah (`ChIJ…`).

## Menjalankan secara lokal

```bash
npm install
npm run dev          # wrangler pages dev → http://localhost:8788
```

Untuk mencoba fitur pencarian secara lokal, buat file `.dev.vars`:

```
GOOGLE_MAPS_API_KEY=AIza...
```

## Deploy ke Cloudflare Pages

### Opsi A — hubungkan repo lewat dashboard (paling mudah)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pilih repo ini, branch `main`.
3. Build command: *(kosongkan)* · Build output directory: `public`.
4. **Save and Deploy**. Situs terbit di `https://<nama-proyek>.pages.dev`.

Direktori `functions/` otomatis dikenali sebagai Pages Functions — tidak perlu konfigurasi tambahan.

### Opsi B — dari terminal

```bash
npx wrangler login
npx wrangler pages deploy
```

### Opsi C — otomatis lewat GitHub Actions

Sudah tersedia di `.github/workflows/deploy.yml`. Tambahkan dua repository secret:

| Secret | Isi |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token dengan permission **Cloudflare Pages: Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID dari dashboard Cloudflare |

Setiap push ke `main` akan otomatis deploy.

## Memasang Google Places API key (opsional)

Fitur pencarian nama usaha memakai [Places API (New)](https://developers.google.com/maps/documentation/places/web-service/op-overview).

1. Buka [Google Cloud Console](https://console.cloud.google.com/), buat project.
2. Aktifkan **Places API (New)**.
3. Buat API key di **Credentials**.
4. Batasi key: **API restrictions → Places API (New)** saja, lalu pasang batas kuota harian.
   Karena key dipakai dari sisi server, pembatasan berdasarkan HTTP referrer tidak berlaku.
5. Pasang sebagai secret Pages:

```bash
npx wrangler pages secret put GOOGLE_MAPS_API_KEY
```

Tanpa key, situs tetap berfungsi penuh lewat mode **Tempel link Google Maps**.

## Struktur

```
public/            aset statis (output directory Pages)
  index.html
  assets/app.css   gaya + tata letak poster A4
  assets/app.js    pencarian, QR, poster, unduhan
  vendor/          bundel qrcode (MIT) — regenerasi: npm run build:vendor
functions/api/     Pages Functions
  status.js        apakah pencarian aktif
  search.js        autocomplete nama usaha
  place.js         detail satu tempat
  resolve.js       link Maps / Place ID → Place ID
lib/               modul bersama yang diimpor Functions
```

## Catatan

- Tidak ada data pengunjung yang disimpan; Functions hanya meneruskan permintaan ke Google.
- Meminta ulasan ke pelanggan diperbolehkan, tetapi **memberi imbalan untuk ulasan positif
  melanggar kebijakan Google** dan bisa membuat ulasan dihapus.
- Proyek ini tidak berafiliasi dengan Google LLC maupun Whitespark.

## Lisensi

MIT — lihat [LICENSE](LICENSE). Bundel QR code memakai
[node-qrcode](https://github.com/soldair/node-qrcode) (MIT), lihat `public/vendor/qrcode-LICENSE.txt`.
