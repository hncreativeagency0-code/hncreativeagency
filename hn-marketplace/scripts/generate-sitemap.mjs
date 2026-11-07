// Writes dist/sitemap.xml after `vite build`.
// Includes static pages, service pages and blog posts (read from src/content), and — when the
// Supabase env vars are available at build time — every published gig, freelancer profile and open request.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const env = { ...Object.fromEntries((fs.existsSync(path.join(root, '.env')) ? fs.readFileSync(path.join(root, '.env'), 'utf8') : '').split('\n').filter((l) => /^\w+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()])), ...process.env };
const SITE = (env.VITE_SITE_URL || 'https://hncreativeagency.pages.dev').replace(/\/$/, '');
const out = path.join(root, process.argv[2] || 'dist', 'sitemap.xml');
const slugs = (file) => [...fs.readFileSync(path.join(root, 'src/content', file), 'utf8').matchAll(/^\s+slug: '([a-z0-9-]+)'/gm)].map((m) => m[1]);
const today = new Date().toISOString().slice(0, 10);

const urls = [
  ['/', '1.0', 'daily'], ['/explore', '0.9', 'daily'], ['/services', '0.8', 'weekly'], ['/jobs', '0.7', 'daily'], ['/freelancers', '0.7', 'daily'],
  ['/agency', '0.8', 'monthly'], ['/pricing', '0.8', 'monthly'], ['/guarantee', '0.7', 'monthly'], ['/trust-safety', '0.6', 'monthly'],
  ['/post-request', '0.6', 'monthly'], ['/managed-projects', '0.6', 'monthly'], ['/book-consultation', '0.6', 'monthly'], ['/case-studies', '0.6', 'monthly'],
  ['/blog', '0.7', 'weekly'], ['/about', '0.5', 'monthly'], ['/contact', '0.5', 'monthly'], ['/how-it-works', '0.5', 'monthly'], ['/help', '0.5', 'monthly'],
  ['/terms', '0.2', 'yearly'], ['/privacy', '0.2', 'yearly'], ['/refund-policy', '0.3', 'yearly'],
  ...slugs('services.ts').map((s) => [`/services/${s}`, '0.8', 'weekly']),
  ...slugs('blog.ts').map((s) => [`/blog/${s}`, '0.6', 'monthly']),
].map(([loc, priority, changefreq]) => ({ loc, priority, changefreq, lastmod: today }));

if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY && !/YOUR-PROJECT/.test(env.VITE_SUPABASE_URL)) {
  const get = async (q) => {
    try { const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${q}`, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` } }); return r.ok ? r.json() : []; }
    catch { return []; }
  };
  const [gigs, people, jobs] = await Promise.all([
    get('gigs?status=eq.published&select=id,updated_at&limit=5000'),
    get('profiles?role=eq.freelancer&status=eq.active&profile_completed=eq.true&select=id,updated_at&limit=5000'),
    get('job_posts?status=eq.open&select=id,updated_at&limit=1000'),
  ]);
  for (const g of gigs) urls.push({ loc: `/gigs/${g.id}`, priority: '0.7', changefreq: 'weekly', lastmod: g.updated_at?.slice(0, 10) ?? today });
  for (const p of people) urls.push({ loc: `/freelancers/${p.id}`, priority: '0.5', changefreq: 'weekly', lastmod: p.updated_at?.slice(0, 10) ?? today });
  for (const j of jobs) urls.push({ loc: `/jobs/${j.id}`, priority: '0.4', changefreq: 'daily', lastmod: j.updated_at?.slice(0, 10) ?? today });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, xml);
console.log(`sitemap.xml: ${urls.length} URLs → ${path.relative(root, out)}`);
