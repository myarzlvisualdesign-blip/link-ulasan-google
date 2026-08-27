import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import jsQR from 'jsqr';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';

const port = 8791;
const baseUrl = `http://127.0.0.1:${port}`;
const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
const reviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`;
const auditDir = join(tmpdir(), 'reviewlink-browser-audit');

const chromeCandidates = [
  process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
].filter(Boolean);
const executablePath = chromeCandidates.find(existsSync);
assert.ok(executablePath, 'Chrome atau Brave tidak ditemukan untuk audit browser');

const wranglerBin = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const server = spawn(process.execPath, [wranglerBin, 'pages', 'dev', 'dist', '--ip', '127.0.0.1', '--port', String(port)], {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/status`);
      if (response.ok) return response.json();
    } catch { /* server masih mulai */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server lokal tidak siap.\n${serverLog}`);
}

function decodePng(buffer) {
  const png = PNG.sync.read(buffer);
  return {
    width: png.width,
    height: png.height,
    result: jsQR(new Uint8ClampedArray(png.data), png.width, png.height),
  };
}

let browser;
try {
  const status = await waitForServer();
  await mkdir(auditDir, { recursive: true });
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto(baseUrl, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.match(await page.title(), /Generator Link Ulasan Google/);

  // Tanpa server key, nama bisnis menampilkan alur bantuan yang tetap bisa diselesaikan.
  await page.locator('#smartInput').fill('Gudang Mainan Jakarta');
  await page.locator('#btnGenerate').click();
  await page.locator('#mapsAssist').waitFor({ state: 'visible' });
  assert.match(await page.locator('#assistOpenMaps').getAttribute('href'), /query=Gudang%20Mainan%20Jakarta/);

  // Place ID mentah menghasilkan link, WhatsApp, poster, dan QR tanpa API key.
  await page.locator('#smartInput').fill(placeId);
  await page.locator('#btnGenerate').click();
  await page.locator('#output').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#qrStatus')?.textContent.includes('Teruji'));
  assert.equal(await page.locator('#reviewLink').inputValue(), reviewUrl);
  assert.equal(await page.locator('#reviewOpen').getAttribute('href'), reviewUrl);
  assert.match(await page.locator('#waShare').getAttribute('href'), /^https:\/\/wa\.me\/\?text=/);

  const canvasDataUrl = await page.locator('#qrCanvas').evaluate((canvas) => canvas.toDataURL('image/png'));
  const canvasQr = decodePng(Buffer.from(canvasDataUrl.split(',')[1], 'base64'));
  assert.equal(canvasQr.result?.data, reviewUrl, 'QR canvas browser harus bisa dipindai');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#dlPng').click();
  const download = await downloadPromise;
  const downloadPath = join(auditDir, download.suggestedFilename());
  await download.saveAs(downloadPath);
  const downloadedQr = decodePng(await readFile(downloadPath));
  assert.equal(downloadedQr.width, 1200);
  assert.equal(downloadedQr.height, 1200);
  assert.equal(downloadedQr.result?.data, reviewUrl, 'QR unduhan harus bisa dipindai');

  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(desktopOverflow <= 1, `Ada overflow desktop ${desktopOverflow}px`);
  const accessibility = await new AxeBuilder({ page }).analyze();
  const severeA11y = accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact));
  if (severeA11y.length) console.error(JSON.stringify(severeA11y, null, 2));
  assert.deepEqual(severeA11y.map((item) => `${item.id}: ${item.help}`), []);
  const desktopShot = join(auditDir, 'desktop.png');
  await page.screenshot({ path: desktopShot, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#output').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#qrStatus')?.textContent.includes('Teruji'));
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(mobileOverflow <= 1, `Ada overflow mobile ${mobileOverflow}px`);
  const mobileShot = join(auditDir, 'mobile.png');
  await page.screenshot({ path: mobileShot, fullPage: true });

  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({
    localApi: status,
    desktop: 'lulus',
    mobile: 'lulus',
    accessibilitySeriousOrCritical: severeA11y.length,
    canvasQrDecode: canvasQr.result?.data,
    downloadedQr: `${downloadedQr.width}x${downloadedQr.height}, terbaca`,
    screenshots: { desktop: desktopShot, mobile: mobileShot },
  }, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
