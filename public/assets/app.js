/* ReviewLink Indonesia — satu kolom, satu QR, tanpa langkah yang membingungkan. */

const QR = (window.QRCodeLib && (window.QRCodeLib.default || window.QRCodeLib)) || null;
const $ = (id) => document.getElementById(id);
const KEY_STORE = 'grlg:apikey';

const state = {
  place: null,
  reviewUrl: '',
  serverKey: null,
  busy: false,
};

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function store(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch { /* localStorage mungkin diblokir browser */ }
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

function notice(message = '', isError = false) {
  const el = $('smartNotice');
  el.textContent = message;
  el.classList.toggle('err', isError);
  el.hidden = !message;
}

function setBusy(busy, label = 'BUAT LINK & QR') {
  state.busy = busy;
  $('smartInput').disabled = busy;
  $('btnGenerate').disabled = busy;
  $('spinner').hidden = !busy;
  $('btnGenerateText').textContent = busy ? 'MEMPROSES…' : label;
}

function hasSearchKey() {
  return state.serverKey === true || Boolean(read(KEY_STORE));
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const userKey = read(KEY_STORE);
  if (userKey) headers['X-Places-Key'] = userKey;

  const response = await fetch(path, { ...options, headers });
  let data = {};
  try { data = await response.json(); } catch { /* respons non-JSON */ }
  if (!response.ok) {
    const error = new Error(data.error || `Permintaan gagal (${response.status}).`);
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

function looksLikeMapInput(value) {
  return /^(https?:\/\/|www\.)/i.test(value)
    || /(?:place_?id|!\d+s(?:Ch|Gh|Ei|El|Ek|Ea))/i.test(value)
    || /^(?:Ch|Gh|Ei|El|Ek|Ea)[A-Za-z0-9_-]{15,}$/.test(value);
}

function mapsSearchUrl(query = '') {
  const trimmed = query.trim();
  return trimmed
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
    : 'https://www.google.com/maps';
}

function updateMapsLinks() {
  const href = mapsSearchUrl($('smartInput').value);
  $('btnOpenMaps').href = href;
  $('assistOpenMaps').href = href;
}

function showAssist(show, query = '') {
  $('mapsAssist').hidden = !show;
  if (query) {
    const href = mapsSearchUrl(query);
    $('btnOpenMaps').href = href;
    $('assistOpenMaps').href = href;
  }
}

function showResults(items = []) {
  const list = $('results');
  list.replaceChildren();

  for (const item of items) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';

    const name = document.createElement('span');
    name.className = 'res-main';
    name.textContent = item.main || 'Bisnis tanpa nama';

    const address = document.createElement('span');
    address.className = 'res-sub';
    address.textContent = item.secondary || '';

    button.append(name, address);
    button.addEventListener('click', () => {
      selectPlace(item.placeId, item.main, item.secondary);
    });
    li.append(button);
    list.append(li);
  }

  list.hidden = items.length === 0;
}

async function submitSmart(event) {
  event?.preventDefault();
  if (state.busy) return;

  const input = $('smartInput').value.trim();
  showResults();
  showAssist(false);
  notice();

  if (!input) {
    notice('Ketik nama bisnis atau tempel link yang disalin dari Google Maps.', true);
    $('smartInput').focus();
    return;
  }

  if (looksLikeMapInput(input)) {
    await resolveMapInput(input);
    return;
  }

  if (state.serverKey === null) await probeStatus();
  if (!hasSearchKey()) {
    showAssist(true, input);
    notice('Pencarian nama memerlukan Google Places API. Gunakan tombol “Cari di Google Maps”, lalu tempel link hasil Bagikan.');
    return;
  }

  await searchByName(input);
}

async function resolveMapInput(input) {
  setBusy(true);
  try {
    const data = await api('/api/resolve', {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
    if (!data.placeId) throw new Error('Place ID tidak ditemukan di link tersebut.');
    await selectPlace(data.placeId, data.name || '', data.address || '');
    if (data.warning) notice(data.warning);
  } catch (error) {
    notice(
      `${error.message || 'Link belum bisa diproses.'} Coba salin ulang dari Google Maps melalui Bagikan → Salin tautan.`,
      true,
    );
    showAssist(true);
  } finally {
    setBusy(false);
  }
}

async function searchByName(query) {
  setBusy(true);
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
    state.serverKey = true;
    const items = data.results || [];
    showResults(items);
    if (!items.length) {
      notice('Bisnis belum ditemukan. Tambahkan nama kota, atau cari lewat Google Maps lalu tempel linknya.');
      showAssist(true, query);
    } else {
      notice('Pilih bisnis yang benar dari hasil berikut.');
    }
    updateSearchStatus();
  } catch (error) {
    if (error.data?.code === 'NO_KEY') {
      state.serverKey = false;
      showAssist(true, query);
      notice('Pencarian nama belum aktif. Cari bisnis di Google Maps, lalu tempel link hasil Bagikan.');
      updateSearchStatus();
    } else {
      notice(error.message || 'Pencarian gagal. Silakan coba lagi.', true);
    }
  } finally {
    setBusy(false);
  }
}

async function pasteFromClipboard() {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) throw new Error('Clipboard kosong.');
    $('smartInput').value = text;
    updateMapsLinks();
    await submitSmart();
  } catch (error) {
    $('smartInput').focus();
    notice(`${error.message || 'Browser tidak mengizinkan akses clipboard.'} Tekan Ctrl+V di kolom di atas.`, true);
  }
}

function reviewUrlFor(placeId) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

function profileUrlFor(placeId) {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

async function selectPlace(placeId, fallbackName = '', fallbackAddress = '') {
  showResults();
  showAssist(false);
  notice();

  state.place = {
    id: placeId,
    name: fallbackName || 'Bisnis Anda',
    address: fallbackAddress || '',
    rating: null,
    ratingCount: null,
  };
  renderOutput();

  if (!hasSearchKey()) return;
  try {
    const detail = await api(`/api/place?id=${encodeURIComponent(placeId)}`);
    if (!detail?.id) return;
    state.place = {
      id: detail.id,
      name: detail.name || state.place.name,
      address: detail.address || state.place.address,
      rating: detail.rating ?? null,
      ratingCount: detail.ratingCount ?? null,
    };
    renderOutput(false);
  } catch { /* detail hanya pelengkap; link dan QR sudah valid */ }
}

function renderPlaceCard(place) {
  const card = $('placeCard');
  card.replaceChildren();

  const badge = document.createElement('span');
  badge.className = 'place-pin';
  badge.textContent = 'G';
  badge.setAttribute('aria-hidden', 'true');

  const info = document.createElement('div');
  info.className = 'place-info';
  const name = document.createElement('p');
  name.className = 'place-name';
  name.textContent = place.name;
  info.append(name);

  if (place.address) {
    const address = document.createElement('p');
    address.className = 'place-addr';
    address.textContent = place.address;
    info.append(address);
  }

  if (Number.isFinite(place.rating)) {
    const rating = document.createElement('span');
    rating.className = 'place-rating';
    rating.textContent = `★ ${place.rating.toFixed(1)}${place.ratingCount ? ` · ${place.ratingCount} ulasan` : ''}`;
    info.append(rating);
  }

  const check = document.createElement('span');
  check.className = 'place-check';
  check.textContent = '✓';
  check.setAttribute('aria-label', 'Bisnis dipilih');
  card.append(badge, info, check);
}

function renderOutput(scroll = true) {
  const place = state.place;
  if (!place) return;

  state.reviewUrl = reviewUrlFor(place.id);
  renderPlaceCard(place);

  $('reviewLink').value = state.reviewUrl;
  $('reviewOpen').href = state.reviewUrl;
  $('profileLink').value = profileUrlFor(place.id);
  $('placeIdOut').value = place.id;

  const message = `Halo! Terima kasih sudah berkunjung ke ${place.name}. Kalau berkenan, bantu kami dengan ulasan singkat di Google melalui link ini: ${state.reviewUrl}`;
  $('waText').value = message;
  $('waShare').href = `https://wa.me/?text=${encodeURIComponent(message)}`;
  $('pvBiz').textContent = place.name;
  $('output').hidden = false;

  const pageUrl = new URL(location.href);
  pageUrl.searchParams.set('place_id', place.id);
  history.replaceState(null, '', pageUrl);

  drawQr();
  requestAnimationFrame(fitPoster);
  if (scroll) $('output').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function qrOptions(width) {
  return {
    width,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#101010', light: '#ffffff' },
  };
}

function paintQr(canvas, width) {
  return new Promise((resolve, reject) => {
    QR.toCanvas(canvas, state.reviewUrl, qrOptions(width), (error) => {
      if (error) reject(error);
      else {
        canvas.style.removeProperty('width');
        canvas.style.removeProperty('height');
        resolve();
      }
    });
  });
}

async function drawQr() {
  if (!state.reviewUrl) return;
  if (!QR) {
    $('qrStatus').textContent = 'QR gagal dimuat. Muat ulang halaman lalu coba lagi.';
    return;
  }

  $('qrStatus').textContent = 'Membuat QR…';
  try {
    await Promise.all([
      paintQr($('qrCanvas'), 420),
      paintQr($('posterQr'), 900),
    ]);
    $('qrStatus').replaceChildren();
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    dot.setAttribute('aria-hidden', 'true');
    $('qrStatus').append(dot, ' Teruji: kontras tinggi · ruang putih aman · siap dipindai');
    fitPoster();
  } catch (error) {
    console.error(error);
    $('qrStatus').textContent = 'QR gagal dibuat. Muat ulang halaman lalu coba lagi.';
  }
}

function slug(text) {
  return (text || 'bisnis').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 44) || 'bisnis';
}

function download(href, filename) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

async function downloadQr() {
  if (!state.reviewUrl || !QR) return;
  try {
    const dataUrl = await QR.toDataURL(state.reviewUrl, qrOptions(1200));
    download(dataUrl, `qr-ulasan-${slug(state.place?.name)}.png`);
    toast('QR PNG 1200px berhasil diunduh');
  } catch (error) {
    console.error(error);
    toast('QR gagal diunduh');
  }
}

async function copyValue(field) {
  try {
    await navigator.clipboard.writeText(field.value);
  } catch {
    field.focus();
    field.select();
    document.execCommand('copy');
  }
  toast('Berhasil disalin');
}

async function shareReview() {
  if (!state.reviewUrl) return;
  const shareData = {
    title: `Ulas ${state.place?.name || 'bisnis ini'} di Google`,
    text: `Bantu beri ulasan untuk ${state.place?.name || 'bisnis ini'} di Google.`,
    url: state.reviewUrl,
  };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch (error) {
      if (error.name !== 'AbortError') await copyValue($('reviewLink'));
    }
  } else {
    await copyValue($('reviewLink'));
  }
}

function resetGenerator() {
  state.place = null;
  state.reviewUrl = '';
  $('output').hidden = true;
  $('smartInput').value = '';
  showResults();
  showAssist(false);
  notice();
  updateMapsLinks();

  const pageUrl = new URL(location.href);
  pageUrl.searchParams.delete('place_id');
  history.replaceState(null, '', pageUrl);
  $('generator').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('smartInput').focus({ preventScroll: true });
}

function openSettings() {
  $('apiKeyInput').value = read(KEY_STORE) || '';
  $('dlgSettings').showModal();
}

function updateSearchStatus() {
  const status = $('searchStatus');
  if (hasSearchKey()) {
    status.textContent = '● Pencarian nama aktif';
    status.classList.add('ready');
  } else {
    status.textContent = '● Mode link Maps siap';
    status.classList.remove('ready');
  }
}

async function probeStatus() {
  try {
    const data = await api('/api/status');
    state.serverKey = Boolean(data.searchAvailable);
  } catch {
    state.serverKey = false;
  }
  updateSearchStatus();
}

function fitPoster() {
  const poster = $('poster');
  const box = poster?.closest('.poster-scale');
  if (!poster || !box || !poster.offsetWidth || !box.clientWidth) return;
  const style = getComputedStyle(box);
  const available = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  box.style.setProperty('--poster-scale', Math.min(1, available / poster.offsetWidth).toFixed(4));
}

$('smartForm').addEventListener('submit', submitSmart);
$('smartInput').addEventListener('input', () => {
  showResults();
  showAssist(false);
  notice();
  updateMapsLinks();
});
$('btnPaste').addEventListener('click', pasteFromClipboard);
$('assistPaste').addEventListener('click', pasteFromClipboard);
$('btnSettings').addEventListener('click', openSettings);
$('footerSettings').addEventListener('click', openSettings);
$('btnReset').addEventListener('click', resetGenerator);
$('dlPng').addEventListener('click', downloadQr);
$('btnPrint').addEventListener('click', () => window.print());
$('btnShare').addEventListener('click', shareReview);

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy]');
  if (button) copyValue($(button.dataset.copy));
  if (!$('results').hidden && !event.target.closest('.generator-card')) showResults();
});

const posterFields = [
  ['posterTitle', 'pvTitle'],
  ['posterSub', 'pvSub'],
  ['posterFoot', 'pvFoot'],
];
for (const [inputId, previewId] of posterFields) {
  $(inputId).addEventListener('input', () => {
    $(previewId).textContent = $(inputId).value;
  });
}
window.addEventListener('resize', () => requestAnimationFrame(fitPoster));

$('dlgSettings').addEventListener('close', async () => {
  if ($('dlgSettings').returnValue === 'save') {
    const value = $('apiKeyInput').value.trim();
    store(KEY_STORE, value);
    toast(value ? 'API key disimpan di browser ini' : 'API key dikosongkan');
    state.serverKey = null;
    await probeStatus();
  } else if ($('dlgSettings').returnValue === 'clear') {
    store(KEY_STORE, null);
    state.serverKey = null;
    toast('API key dihapus');
    await probeStatus();
  }
});

(async function init() {
  updateMapsLinks();
  await probeStatus();
  const placeId = new URL(location.href).searchParams.get('place_id');
  if (placeId) await selectPlace(placeId);
})();
