/* Google Analytics 4 + Meta Pixel + Search Console verification.
   Nothing loads unless the IDs are set at build time:
     VITE_GA_ID=G-XXXXXXX   VITE_META_PIXEL_ID=1234567890   VITE_GSC_VERIFICATION=abc123
   Never loaded in the live-preview build. */
import { DEMO } from './supabase';

type Fn = (...args: unknown[]) => void;
declare global { interface Window { dataLayer?: unknown[]; gtag?: Fn; fbq?: Fn & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: Fn; push?: Fn } } }

const GA = import.meta.env.VITE_GA_ID as string | undefined;
const PIXEL = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const GSC = import.meta.env.VITE_GSC_VERIFICATION as string | undefined;
let started = false;

function addScript(src: string) {
  const s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s);
}

export function initAnalytics() {
  if (started || DEMO || typeof window === 'undefined') return;
  started = true;
  if (GSC) {
    const m = document.createElement('meta'); m.name = 'google-site-verification'; m.content = GSC; document.head.appendChild(m);
  }
  if (GA) {
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA)}`);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
    window.gtag('js', new Date());
    window.gtag('config', GA, { send_page_view: false, anonymize_ip: true });
  }
  if (PIXEL) {
    const f = window as Window;
    if (!f.fbq) {
      const n = function (...args: unknown[]) { n.callMethod ? n.callMethod(...args) : n.queue!.push(args); } as NonNullable<Window['fbq']>;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      f.fbq = n;
      addScript('https://connect.facebook.net/en_US/fbevents.js');
    }
    f.fbq!('init', PIXEL);
  }
}

export function trackPage(path: string) {
  if (DEMO) return;
  window.gtag?.('event', 'page_view', { page_path: path, page_location: window.location.href, page_title: document.title });
  window.fbq?.('track', 'PageView');
}

type EventName = 'sign_up' | 'lead' | 'begin_checkout' | 'add_payment_info' | 'purchase' | 'post_request' | 'search' | 'contact';
const PIXEL_MAP: Partial<Record<EventName, string>> = {
  sign_up: 'CompleteRegistration', lead: 'Lead', begin_checkout: 'InitiateCheckout', add_payment_info: 'AddPaymentInfo', purchase: 'Purchase', search: 'Search', contact: 'Contact',
};

export function track(event: EventName, params: Record<string, unknown> = {}) {
  if (DEMO) return;
  window.gtag?.('event', event, params);
  const px = PIXEL_MAP[event];
  if (px) window.fbq?.('track', px, params.value != null ? { value: params.value, currency: 'PKR', ...params } : params);
}
