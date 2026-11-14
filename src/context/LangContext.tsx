import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** English / Urdu toggle for the main public pages (navigation, home page, trust messages, footer).
    Account pages stay in English for now. Urdu text uses Noto Nastaliq Urdu and right-to-left direction. */
export type Lang = 'en' | 'ur';

const ur = {
  'nav.explore': 'سروسز دیکھیں',
  'nav.freelancers': 'فری لانسرز',
  'nav.jobs': 'کام کی درخواستیں',
  'nav.agency': 'ہماری ایجنسی',
  'nav.pricing': 'فیس اور قیمتیں',
  'nav.signin': 'سائن اِن',
  'nav.join': 'شامل ہوں',
  'nav.dashboard': 'ڈیش بورڈ',
  'nav.post': 'درخواست پوسٹ کریں',
  'hero.badge': 'پاکستان کا اپنا فری لانس مارکیٹ پلیس',
  'hero.title1': 'پاکستان کا سستا اور محفوظ',
  'hero.title2': 'فری لانس مارکیٹ پلیس',
  'hero.sub': 'کام پورا یا پیسے واپس۔ تصدیق شدہ ڈیزائنرز، ویڈیو ایڈیٹرز، ویب ڈویلپرز اور مارکیٹرز — جاز کیش، ایزی پیسہ یا بینک ٹرانسفر سے ادائیگی کریں۔',
  'hero.search': 'مثلاً "لوگو ڈیزائن" یا "شاپیفائی اسٹور"',
  'hero.searchBtn': 'تلاش کریں',
  'hero.popular': 'مقبول:',
  'hero.fee': 'PKR 5,000 تک کے آرڈر پر کوئی سروس فیس نہیں',
  'trust.protect': 'ادائیگی محفوظ',
  'trust.protectD': 'آپ کی منظوری تک رقم محفوظ رہتی ہے',
  'trust.money': 'پیسے واپسی کی گارنٹی',
  'trust.moneyD': 'کام پورا یا پیسے واپس',
  'trust.verified': 'تصدیق شدہ فری لانسرز',
  'trust.verifiedD': 'شناختی کارڈ اور کام کی جانچ',
  'trust.support': 'اردو اور انگریزی سپورٹ',
  'trust.supportD': 'واٹس ایپ پر فوری جواب',
  'paths.title': 'آپ کو کیا چاہیے؟',
  'paths.freelancer': 'فری لانسر ہائر کریں',
  'paths.freelancerD': 'چھوٹے کام PKR 500 سے۔ پیکیج چنیں، چیٹ کریں، اور کام مکمل ہونے پر منظوری دیں۔',
  'paths.agency': 'ایجنسی ہائر کریں',
  'paths.agencyD': 'HN کی اپنی ٹیم پورا پراجیکٹ سنبھالتی ہے — ایک پراجیکٹ مینیجر، معیار کی گارنٹی۔',
  'paths.request': 'درخواست پوسٹ کریں',
  'paths.requestD': 'اپنی ضرورت لکھیں اور فری لانسرز آپ کو آفرز بھیجیں گے۔',
  'cta.browse': 'سروسز دیکھیں',
  'cta.agency': 'ایجنسی پیکیجز',
  'cta.post': 'درخواست لکھیں',
  'how.title': 'یہ کیسے کام کرتا ہے',
  'footer.about': 'پاکستان کا فری لانس مارکیٹ پلیس اور کریئیٹو ایجنسی — ڈیزائن، ویڈیو، ویب سائٹس اور ڈیجیٹل مارکیٹنگ۔',
  'whatsapp': 'واٹس ایپ پر بات کریں',
  'lang.toggle': 'English',
} as const;

export type TKey = keyof typeof ur;

const en: Record<TKey, string> = {
  'nav.explore': 'Explore services',
  'nav.freelancers': 'Freelancers',
  'nav.jobs': 'Requests',
  'nav.agency': 'Our Agency',
  'nav.pricing': 'Pricing & Fees',
  'nav.signin': 'Sign in',
  'nav.join': 'Join',
  'nav.dashboard': 'Go to dashboard',
  'nav.post': 'Post a request',
  'hero.badge': 'Made for Pakistan · PKR pricing · Local payments',
  'hero.title1': 'Pakistan’s affordable, safe',
  'hero.title2': 'freelance marketplace',
  'hero.sub': 'Work done or your money back. Hire verified designers, video editors, web developers and marketers — and pay with JazzCash, Easypaisa or bank transfer.',
  'hero.search': 'Try "logo design" or "Shopify store"',
  'hero.searchBtn': 'Search',
  'hero.popular': 'Popular:',
  'hero.fee': 'No service fee on orders up to PKR 5,000',
  'trust.protect': 'Payment protection',
  'trust.protectD': 'Your money is safe until you approve the delivery',
  'trust.money': 'Money-back guarantee',
  'trust.moneyD': 'Work done, or your money back',
  'trust.verified': 'Verified freelancers',
  'trust.verifiedD': 'CNIC and work-sample checks',
  'trust.support': 'Urdu & English support',
  'trust.supportD': 'Quick replies on WhatsApp',
  'paths.title': 'How would you like to work?',
  'paths.freelancer': 'Hire a Freelancer',
  'paths.freelancerD': 'Small jobs from PKR 500. Pick a package, chat, and approve the delivery when you are happy.',
  'paths.agency': 'Hire the Agency',
  'paths.agencyD': 'HN’s in-house team runs the whole project — one project manager, quality guaranteed.',
  'paths.request': 'Post a Request',
  'paths.requestD': 'Describe what you need and let freelancers send you proposals.',
  'cta.browse': 'Browse services',
  'cta.agency': 'Agency packages',
  'cta.post': 'Post a request',
  'how.title': 'How it works',
  'footer.about': 'Pakistan’s freelance marketplace and creative agency — design, video, websites and digital marketing.',
  'whatsapp': 'Chat on WhatsApp',
  'lang.toggle': 'اردو',
};

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string; isUr: boolean }
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => undefined, t: (k) => en[k], isUr: false });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => { try { return localStorage.getItem('hn-lang') === 'ur' ? 'ur' : 'en'; } catch { return 'en'; } });
  useEffect(() => {
    document.documentElement.lang = lang === 'ur' ? 'ur' : 'en';
    // Load the Urdu font only when someone switches to Urdu
    if (lang === 'ur' && !document.getElementById('font-urdu')) {
      const l = document.createElement('link');
      l.id = 'font-urdu'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600&display=swap';
      document.head.appendChild(l);
    }
  }, [lang]);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('hn-lang', l); } catch { /* storage blocked */ } };
  const t = (k: TKey) => (lang === 'ur' ? ur[k] : en[k]);
  return <LangCtx.Provider value={{ lang, setLang, t, isUr: lang === 'ur' }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);

/** Props for a text element that may be Urdu: right-to-left + Nastaliq font. */
export const urProps = (isUr: boolean) => (isUr ? { dir: 'rtl' as const, className: 'font-urdu leading-[2]' } : { className: '' });
