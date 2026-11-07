/* Cloudflare Pages Function — server-side SEO for a single-page app.
   Search engines and WhatsApp/Facebook link previews read the <title> and meta tags in the HTML.
   This middleware fills them in per page (gigs, freelancer profiles, requests, services, blog)
   before the app loads, so every page has its own title, description and share image.

   Needs these Pages environment variables (Settings → Environment variables), the same values as the build:
     VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   (public, read-only anon key)
   Optional: VITE_SITE_URL (defaults to the request origin). */

const STATIC = {
  '/': ['Pakistan’s Affordable & Safe Freelance Marketplace', 'Hire verified Pakistani freelancers for logos, websites, video editing, social media and ads. Pay with JazzCash, Easypaisa or bank transfer. Work done or your money back.'],
  '/explore': ['Explore Freelance Services in Pakistan', 'Browse logo design, websites, video editing, social media and ads services with clear PKR packages.'],
  '/freelancers': ['Hire Pakistani Freelancers', 'Browse verified Pakistani designers, video editors, developers and marketers.'],
  '/jobs': ['Freelance Requests from Pakistani Clients', 'Open requests from clients in Pakistan. Send a proposal in minutes.'],
  '/post-request': ['Post a Request – Get Proposals from Freelancers', 'Describe what you need and get proposals with prices in PKR. Free to post.'],
  '/agency': ['Creative Agency in Lahore – Branding, Websites & Marketing in PKR', 'HN’s in-house team handles branding, websites, social media and ads. Packages from PKR 3,000.'],
  '/pricing': ['Pricing & Fees – Lower Fees than Fiverr', 'Freelancers keep 90% of every order. No client fee on orders up to PKR 5,000.'],
  '/guarantee': ['Money-Back Guarantee – Work Done or Your Money Back', 'Your payment is held until you approve the delivery. If the work isn’t delivered, you get a refund.'],
  '/trust-safety': ['Trust & Safety – Payment Protection & Verified Freelancers', 'Payment held until approval, CNIC-verified freelancers, private files and fast dispute support.'],
  '/case-studies': ['Case Studies & Portfolio', 'Work by HN Creative Agency’s studio team.'],
  '/blog': ['Blog – Price Guides & Hiring Tips for Pakistan', 'Logo design prices, website costs, social media packages and safe hiring tips.'],
  '/services': ['Services – Logo, Website, Video, Social Media & Ads in PKR', 'Clear PKR starting prices for the most popular services.'],
  '/managed-projects': ['Managed Projects – HN Runs Your Project End-to-End', 'One project manager, one PKR price, guaranteed quality.'],
  '/book-consultation': ['Book a Free Consultation', 'A free 20-minute call to plan your logo, website, social media or ads — in Urdu or English.'],
  '/about': ['About Us', 'A Lahore-based creative agency building Pakistan’s safe freelance marketplace.'],
  '/contact': ['Contact Us – WhatsApp, Email & Office in Lahore', 'Talk to us in Urdu or English on WhatsApp or by email.'],
  '/how-it-works': ['How It Works – Hire or Sell Safely', 'Find a freelancer, pay safely, approve the delivery — or get your money back.'],
  '/help': ['Help Center', 'Answers about payments, fees, payouts, refunds and verification.'],
};
const BRAND = 'HN Creative Agency';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clip = (s, n = 158) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const money = (n) => `PKR ${Number(n ?? 0).toLocaleString('en-PK')}`;
const UUID = /^[0-9a-f-]{36}$/i;

async function rest(env, path) {
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL; const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!base || !key) return null;
  const r = await fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/vnd.pgrst.object+json' }, cf: { cacheTtl: 300 } });
  return r.ok ? r.json() : null;
}

async function metaFor(path, env) {
  if (STATIC[path]) return { title: STATIC[path][0], description: STATIC[path][1] };
  let m;
  if ((m = path.match(/^\/gigs\/([^/]+)$/)) && UUID.test(m[1])) {
    const g = await rest(env, `gigs?id=eq.${m[1]}&status=eq.published&select=title,description,cover_url,starting_price,freelancer:profiles!gigs_freelancer_id_fkey(full_name)`);
    if (g) return { title: `${g.title.replace(/^I will /i, '').replace(/^./, (c) => c.toUpperCase())} – from ${money(g.starting_price)}`, description: clip(`${g.description} — by ${g.freelancer?.full_name ?? 'a verified freelancer'}. Payment protected.`), image: /^https?:/.test(g.cover_url ?? '') ? g.cover_url : null, type: 'product' };
  }
  if ((m = path.match(/^\/freelancers\/([^/]+)$/)) && UUID.test(m[1])) {
    const p = await rest(env, `profiles?id=eq.${m[1]}&role=eq.freelancer&select=full_name,title,bio,city,avatar_url`);
    if (p) return { title: `${p.full_name} – ${p.title || 'Freelancer'}${p.city ? ` in ${p.city}` : ''}`, description: clip(p.bio || `Hire ${p.full_name} on ${BRAND}.`), image: p.avatar_url, type: 'profile' };
  }
  if ((m = path.match(/^\/jobs\/([^/]+)$/)) && UUID.test(m[1])) {
    const j = await rest(env, `job_posts?id=eq.${m[1]}&select=title,description`);
    if (j) return { title: j.title, description: clip(j.description) };
  }
  if ((m = path.match(/^\/(services|blog)\/([a-z0-9-]+)$/))) {
    const words = m[2].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return { title: m[1] === 'services' ? `${words} in Pakistan` : words, description: STATIC['/'][1], type: m[1] === 'blog' ? 'article' : 'website' };
  }
  return null;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const res = await next();
  const type = res.headers.get('content-type') || '';
  if (request.method !== 'GET' || !type.includes('text/html')) return res;
  if (/^\/(app|admin)(\/|$)/.test(url.pathname)) {           // private areas: never index
    const r = new Response(res.body, res); r.headers.set('X-Robots-Tag', 'noindex'); return r;
  }
  let meta = null;
  try { meta = await metaFor(url.pathname.replace(/\/$/, '') || '/', env); } catch { meta = null; }
  if (!meta) return res;
  const site = (env.VITE_SITE_URL || url.origin).replace(/\/$/, '');
  const title = `${meta.title} | ${BRAND}`;
  const img = meta.image || `${site}/og-image.jpg`;
  const canonical = `${site}${url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '')}`;
  const tags = `
    <meta name="description" content="${esc(meta.description)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(meta.description)}" />
    <meta property="og:type" content="${esc(meta.type || 'website')}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:image" content="${esc(img)}" />
    <meta property="og:site_name" content="${BRAND}" />
    <meta name="twitter:card" content="summary_large_image" />`;
  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(title); } })
    .on('meta[name="description"]', { element(e) { e.remove(); } })
    .on('meta[property^="og:"]', { element(e) { e.remove(); } })
    .on('meta[name^="twitter:"]', { element(e) { e.remove(); } })
    .on('link[rel="canonical"]', { element(e) { e.remove(); } })
    .on('head', { element(e) { e.append(tags, { html: true }); } })
    .transform(res);
}
