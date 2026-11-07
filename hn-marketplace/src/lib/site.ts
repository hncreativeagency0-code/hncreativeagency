import { usePublicSettings, type PlatformSettings } from './hooks';

/**
 * One place for the brand's public details. Contact details can be changed without a rebuild
 * from Admin → Settings → "Contact details on the website"; the values here are fallbacks.
 * Set VITE_SUPPORT_EMAIL to your domain address (e.g. support@yourdomain.com) once it exists.
 */
const env = import.meta.env;
export const SITE = {
  name: 'HN Creative Agency',
  tagline: 'Design. Market. Grow.',
  url: ((env.VITE_SITE_URL as string | undefined) || 'https://hncreativeagency.pages.dev').replace(/\/$/, ''),
  email: (env.VITE_SUPPORT_EMAIL as string | undefined) || 'hncreativeagencyhr@gmail.com',
  phone: '+92 317 6250671',
  whatsapp: '923176250671',
  address: 'Thoker Niaz Baig, Lahore, Pakistan 53700',
  hours: 'Mon–Sat, 10am–7pm (PKT)',
  ogImage: '/og-image.jpg',
};

export interface SiteContact { email: string; phone: string; whatsapp: string; address: string; hours: string; whatsappUrl: string; telUrl: string }

export function contactFrom(s: PlatformSettings | null): SiteContact {
  const c = s?.site_contact;
  const email = c?.email?.trim() || SITE.email;
  const phone = c?.phone?.trim() || SITE.phone;
  const whatsapp = (c?.whatsapp || SITE.whatsapp).replace(/[^\d]/g, '');
  return {
    email, phone, whatsapp, address: c?.address?.trim() || SITE.address, hours: s?.support_hours || SITE.hours,
    whatsappUrl: `https://wa.me/${whatsapp}`, telUrl: `tel:+${phone.replace(/[^\d]/g, '')}`,
  };
}

/** Contact details, live from platform settings with sensible fallbacks. */
export function useSiteContact(): SiteContact {
  return contactFrom(usePublicSettings());
}

export const waLink = (number: string, text?: string) => `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
