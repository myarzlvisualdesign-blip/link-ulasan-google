/** Menyusun folder dist/ siap Direct Upload ke Cloudflare Pages. */
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const OUT = 'dist';

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp('public', OUT, { recursive: true });

await build({
  entryPoints: ['scripts/worker-entry.js'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: `${OUT}/_worker.js`,
  platform: 'neutral',
});

// Pages mengecualikan _worker.js dari aset statis; ditegaskan agar tidak ikut terunggah.
await writeFile(`${OUT}/.assetsignore`, '_worker.js\n');

console.log(`dist/ siap — unggah folder ini lewat Cloudflare Pages → Upload assets`);
