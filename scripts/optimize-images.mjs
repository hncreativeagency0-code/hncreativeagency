// Creates compressed .webp copies of every JPG/PNG in /public (originals are kept as a fallback).
// The site's <LegacyImg> loads the .webp first automatically.   Run: npm run images:optimize
import fs from 'node:fs';
import path from 'node:path';

let sharp;
try { sharp = (await import('sharp')).default; } catch { console.error('Install sharp first: npm i -D sharp'); process.exit(1); }
const root = path.resolve(new URL('../public', import.meta.url).pathname);
const skip = /^(icon-|apple-touch|favicon-32|og-image)/;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
let saved = 0, n = 0;
for (const f of walk(root).filter((x) => /\.(jpe?g|png)$/i.test(x) && !skip.test(path.basename(x)))) {
  const out = f.replace(/\.(jpe?g|png)$/i, '.webp');
  const img = sharp(f);
  const meta = await img.metadata();
  await img.resize({ width: Math.min(meta.width ?? 1600, 1600), withoutEnlargement: true }).webp({ quality: 78 }).toFile(out);
  const a = fs.statSync(f).size, b = fs.statSync(out).size; saved += a - b; n++;
  console.log(`${path.relative(root, f)} → ${path.basename(out)}  ${(a / 1024).toFixed(0)} KB → ${(b / 1024).toFixed(0)} KB`);
}
console.log(n ? `Done: ${n} images, saved ${(saved / 1048576).toFixed(1)} MB` : 'No JPG/PNG images found in public/. Run npm run assets:copy first.');
