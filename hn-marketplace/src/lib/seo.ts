import { useEffect } from 'react';
import { SITE } from './site';

interface SeoInput {
  title?: string;           // page title without the brand suffix
  description?: string;
  path?: string;            // canonical path, e.g. /gigs/123
  image?: string | null;
  type?: 'website' | 'article' | 'product' | 'profile';
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const DEFAULT_DESC = 'Pakistan’s affordable, safe freelance marketplace. Hire verified designers, video editors, web developers and marketers — pay with JazzCash, Easypaisa or bank transfer. Work done or your money back.';

function setMeta(attr: 'name' | 'property', key: string, value: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (value == null) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', value);
}
function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
  el.href = href;
}

/** Per-page title, description, canonical URL, social cards and structured data. */
export function useSeo({ title, description, path, image, type = 'website', noindex, jsonLd }: SeoInput) {
  const json = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    const full = title ? `${title} | ${SITE.name}` : `${SITE.name} – Pakistan’s Safe Freelance Marketplace`;
    const desc = (description || DEFAULT_DESC).replace(/\s+/g, ' ').trim().slice(0, 160);
    const url = `${SITE.url}${path ?? (typeof window !== 'undefined' ? window.location.pathname : '/')}`;
    const img = image && /^https?:/.test(image) ? image : `${SITE.url}${image || SITE.ogImage}`;
    document.title = full;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', img);
    setMeta('property', 'og:site_name', SITE.name);
    setMeta('property', 'og:locale', 'en_PK');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', full);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', img);
    setLink('canonical', url);
    let script = document.getElementById('page-jsonld');
    if (json) {
      if (!script) { script = document.createElement('script'); script.id = 'page-jsonld'; script.setAttribute('type', 'application/ld+json'); document.head.appendChild(script); }
      script.textContent = json;
    } else script?.remove();
  }, [title, description, path, image, type, noindex, json]);
}

export const orgJsonLd = () => ({
  '@context': 'https://schema.org', '@type': 'Organization', name: SITE.name, url: SITE.url, logo: `${SITE.url}/assets/images/favicon.png`,
  areaServed: 'PK', address: { '@type': 'PostalAddress', addressLocality: 'Lahore', addressCountry: 'PK' },
  contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', telephone: SITE.phone, availableLanguage: ['English', 'Urdu'], areaServed: 'PK' }],
});
