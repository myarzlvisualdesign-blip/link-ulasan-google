/* Generator Link Ulasan Google — frontend */

const QR = (window.QRCodeLib && (window.QRCodeLib.default || window.QRCodeLib)) || null;

const $ = (id) => document.getElementById(id);
const KEY_STORE = 'grlg:apikey';
const THEME_STORE = 'grlg:theme';

const state = {
  place: null,          // { id, name, address, rating, ratingCount }
  reviewUrl: '',
  serverKey: null,      // null = belum dicek, true/false = hasil cek
};

/* ------------------------------------------------------------------ utils */

function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* private mode */ }
}
function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function notice(el, message, isError = false) {
  if (!message) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.classList.toggle('err', isError);
  el.innerHTML = message;
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const userKey = read(KEY_STORE);
  if (userKey) headers['X-Places-Key'] = userKey;

  const res = await fetch(path, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch { /* non-json */ }
  if (!res.ok) throw Object.assign(new Error(data.error || `Gagal (${res.status})`), { data });
  return data;
}

/* ------------------------------------------------------------------ theme */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('themeIcon').innerHTML = theme === 'dark' ? '&#9788;' : '&#9789;';
  store(THEME_STORE, theme);
}
(function initTheme() {
  const saved = read(THEME_STORE);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
})();
$('btnTheme').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* ------------------------------------------------------------------- tabs */

const tabs = [
  { tab: $('tab-search'), pane: $('pane-search') },
  { tab: $('tab-manual'), pane: $('pane-manual') },
];
tabs.forEach(({ tab }, i) => {
  tab.addEventListener('click', () => {
    tabs.forEach(({ tab: t, pane: p }, j) => {
      const active = i === j;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
      p.hidden = !active;
    });
  });
});
/* ---------------------------------------------------------------- API key */

const dlg = $('dlgSettings');
$('btnSettings').addEventListener('click', () => {
  $('apiKeyInput').value = read(KEY_STORE) || '';
  dlg.showModal();
});
dlg.addEventListener('close', () => {
  if (dlg.returnValue === 'save') {
    const value = $('apiKeyInput').value.trim();
    store(KEY_STORE, value || null);
    toast(value ? 'API key disimpan' : 'API key dikosongkan');
    notice($('searchNotice'), '');
  } else if (dlg.returnValue === 'clear') {
    store(KEY_STORE, null);
    toast('API key dihapus');
  }
});

/* ------------------------------------------------------------- pencarian */

const results = $('results');
const qInput = $('q');

function showResults(items) {
  results.innerHTML = '';
  if (!items.length) {
    results.hidden = true;
    qInput.setAttribute('aria-expanded', 'false');
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'option');
    const main = document.createElement('span');
    main.className = 'res-main';
    main.textContent = item.main;
    const sub = document.createElement('span');
    sub.className = 'res-sub';
    sub.textContent = item.secondary || '';
    btn.append(main, sub);
    btn.addEventListener('click', () => selectPlace(item.placeId, item.main, item.secondary));
    li.append(btn);
    results.append(li);
  }
  results.hidden = false;
  qInput.setAttribute('aria-expanded', 'true');
}

const runSearch = debounce(async (term) => {
  $('spinner').hidden = false;
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(term)}`);
    state.serverKey = true;
    notice($('searchNotice'), '');
    showResults(data.results || []);
    if (!(data.results || []).length) {
      notice($('searchNotice'),
        'Tidak ada hasil. Coba tambahkan nama kota, atau pakai tab <b>Tempel link Google Maps</b>.');
    }
  } catch (err) {
    showResults([]);
    if (err.data && err.data.code === 'NO_KEY') {
      state.serverKey = false;
      notice($('searchNotice'),
        'Pencarian nama usaha butuh Google Places API key. ' +
        'Pasang key Anda lewat tombol <b>API Key</b> di atas, atau gunakan tab ' +
        '<b>Tempel link Google Maps</b> yang tidak butuh key sama sekali.', true);
    } else {
      notice($('searchNotice'), err.message || 'Pencarian gagal.', true);
    }
  } finally {
    $('spinner').hidden = true;
  }
}, 350);

qInput.addEventListener('input', () => {
  const term = qInput.value.trim();
  if (term.length < 3) { showResults([]); notice($('searchNotice'), ''); return; }
  runSearch(term);
});

document.addEventListener('click', (event) => {
  if (!results.hidden && !results.contains(event.target) && event.target !== qInput) {
    showResults([]);
  }
});

/* --------------------------------------------------------- mode manual */

$('btnResolve').addEventListener('click', resolveManual);
$('manualInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); resolveManual(); }
});

async function resolveManual() {
  const input = $('manualInput').value.trim();
  if (!input) { notice($('manualNotice'), 'Tempel dulu link Google Maps Anda.', true); return; }
  const btn = $('btnResolve');
  btn.disabled = true;
  btn.textContent = 'Memproses…';
  notice($('manualNotice'), '');
  try {
    const data = await api('/api/resolve', { method: 'POST', body: JSON.stringify({ input }) });
    if (!data.placeId) throw new Error(data.error || 'Place ID tidak ditemukan di link tersebut.');
    await selectPlace(data.placeId, data.name || '', data.address || '');
    if (data.warning) notice($('manualNotice'), data.warning);
  } catch (err) {
    notice($('manualNotice'),
      (err.message || 'Gagal memproses link.') +
      '<br><br>Tips: pakai link dari tombol <b>Bagikan &rarr; Salin tautan</b> di aplikasi Google Maps. ' +
      'Link yang disalin dari address bar browser desktop juga bisa.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Proses link';
  }
}

/* ------------------------------------------------------- pilih & render */

async function selectPlace(placeId, fallbackName = '', fallbackAddress = '') {
  showResults([]);
  state.place = {
    id: placeId,
    name: fallbackName || 'Usaha Anda',
    address: fallbackAddress || '',
    rating: null,
    ratingCount: null,
  };
  render();

  // Lengkapi detail (nama resmi, alamat, rating) bila key tersedia — opsional.
  if (state.serverKey === false && !read(KEY_STORE)) return;
  try {
    const detail = await api(`/api/place?id=${encodeURIComponent(placeId)}`);
    if (detail && detail.id) {
      state.place = {
        id: detail.id,
        name: detail.name || state.place.name,
        address: detail.address || state.place.address,
        rating: detail.rating ?? null,
        ratingCount: detail.ratingCount ?? null,
      };
      render();
    }
  } catch { /* detail opsional, link tetap jalan tanpa ini */ }
}

function reviewUrlFor(placeId) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
function profileUrlFor(placeId) {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

function render() {
  const place = state.place;
  if (!place) return;

  state.reviewUrl = reviewUrlFor(place.id);

  const card = $('placeCard');
  card.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'place-info';
  const name = document.createElement('p');
  name.className = 'place-name';
  name.textContent = place.name;
  info.append(name);
  if (place.address) {
    const addr = document.createElement('p');
    addr.className = 'place-addr';
    addr.textContent = place.address;
    info.append(addr);
  }
  if (place.rating) {
    const rating = document.createElement('span');
    rating.className = 'place-rating';
    rating.textContent = `★ ${place.rating.toFixed(1)}` +
      (place.ratingCount ? ` · ${place.ratingCount} ulasan` : '');
    info.append(rating);
  }
  card.append(info);

  $('reviewLink').value = state.reviewUrl;
  $('profileLink').value = profileUrlFor(place.id);
  $('placeIdOut').value = place.id;
  $('reviewOpen').href = state.reviewUrl;
  $('waText').value =
    `Halo! Terima kasih sudah mampir ke ${place.name}. ` +
    `Kalau berkenan, boleh bantu kami dengan ulasan singkat di Google? ` +
    `Cukup klik: ${state.reviewUrl}`;

  $('pvBiz').textContent = place.name;
  $('output').hidden = false;

  const url = new URL(location.href);
  url.searchParams.set('place_id', place.id);
  history.replaceState(null, '', url);

  drawQr();
  requestAnimationFrame(fitPoster);
}

/* ------------------------------------------------------------------- QR */

function qrOptions(width) {
  const transparent = $('qrTransparent').checked;
  return {
    width,
    margin: 2,
    errorCorrectionLevel: $('qrEcc').value,
    color: {
      dark: $('qrDark').value,
      light: transparent ? '#00000000' : $('qrLight').value,
    },
  };
}

/** qrcode menulis width/height inline di canvas; buang supaya CSS yang menentukan ukuran tampil. */
function paint(canvasId, options, done) {
  const canvas = $(canvasId);
  QR.toCanvas(canvas, state.reviewUrl, options, (err) => {
    if (err) { console.error(err); return; }
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    if (done) done();
  });
}

function drawQr() {
  if (!state.reviewUrl || !QR) return;
  paint('qrCanvas', qrOptions(320));
  paint('posterQr',
    { ...qrOptions(900), color: { dark: $('qrDark').value, light: '#ffffff' } },
    fitPoster);
}

['qrDark', 'qrLight', 'qrEcc', 'qrTransparent'].forEach((id) => {
  $(id).addEventListener('input', drawQr);
});

function download(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
}

function slug(text) {
  return (text || 'usaha').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 40) || 'usaha';
}

async function downloadPng(size) {
  if (!state.reviewUrl) return;
  try {
    const dataUrl = await QR.toDataURL(state.reviewUrl, qrOptions(size));
    download(dataUrl, `qr-ulasan-${slug(state.place.name)}-${size}.png`);
    toast(`QR ${size}px diunduh`);
  } catch (err) {
    toast('Gagal membuat PNG');
    console.error(err);
  }
}

$('dlPng').addEventListener('click', () => downloadPng(1024));
$('dlPngBig').addEventListener('click', () => downloadPng(2048));
$('dlSvg').addEventListener('click', async () => {
  if (!state.reviewUrl) return;
  try {
    const svg = await QR.toString(state.reviewUrl, { ...qrOptions(1024), type: 'svg' });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    download(url, `qr-ulasan-${slug(state.place.name)}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('QR SVG diunduh');
  } catch (err) {
    toast('Gagal membuat SVG');
    console.error(err);
  }
});

/* --------------------------------------------------------------- poster */

const posterFields = [
  ['posterTitle', 'pvTitle'],
  ['posterSub', 'pvSub'],
  ['posterFoot', 'pvFoot'],
];
posterFields.forEach(([input, preview]) => {
  $(input).addEventListener('input', () => { $(preview).textContent = $(input).value; });
});
$('btnPrint').addEventListener('click', () => window.print());

function fitPoster() {
  const poster = $('poster');
  const box = poster.closest('.poster-scale');
  if (!poster || !box || !poster.offsetWidth || !box.clientWidth) return;
  const style = getComputedStyle(box);
  const available = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const scale = Math.min(1, available / poster.offsetWidth);
  box.style.setProperty('--poster-scale', scale.toFixed(4));
}
window.addEventListener('resize', debounce(fitPoster, 120));

/* ---------------------------------------------------------------- salin */

document.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-copy]');
  if (!btn) return;
  const field = $(btn.dataset.copy);
  try {
    await navigator.clipboard.writeText(field.value);
  } catch {
    field.select();
    document.execCommand('copy');
  }
  toast('Tersalin ke clipboard');
});

/* ------------------------------------------------------- state dari URL */

(function initFromUrl() {
  const placeId = new URL(location.href).searchParams.get('place_id');
  if (placeId) selectPlace(placeId);
})();

/* --------------------------------------------- cek ketersediaan key server */

(async function probeKey() {
  try {
    const data = await api('/api/status');
    state.serverKey = !!data.searchAvailable;
    if (!state.serverKey && !read(KEY_STORE)) {
      notice($('searchNotice'),
        'Pencarian nama usaha belum aktif di situs ini (butuh Google Places API key). ' +
        'Anda bisa memasang key sendiri lewat tombol <b>API Key</b>, atau langsung pakai tab ' +
        '<b>Tempel link Google Maps</b> &mdash; cara itu tidak butuh key.');
      qInput.placeholder = 'Butuh API key — atau pakai tab sebelah';
    }
  } catch { /* biarkan; error sebenarnya muncul saat mencari */ }
})();
