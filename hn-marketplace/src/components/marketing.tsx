import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, RotateCcw, BadgeCheck, MessageCircle, Sparkles, TrendingUp, Award, CheckCircle2, CalendarDays } from 'lucide-react';
import { supabase, errorMessage } from '@/lib/supabase';
import { useSiteContact, waLink } from '@/lib/site';
import { useLang } from '@/context/LangContext';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { track } from '@/lib/analytics';
import { estimate, pct } from '@/lib/fees';
import { usePublicSettings } from '@/lib/hooks';
import type { Profile } from '@/lib/types';
import { cn, money } from '@/lib/utils';
import { Badge, Button, Card, Input, Select, Textarea } from './ui';

export function SectionTitle({ eyebrow, title, sub, light, className }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; light?: boolean; className?: string }) {
  return (
    <div className={cn('mx-auto max-w-2xl text-center', className)}>
      {eyebrow && <span className="text-sm font-semibold uppercase tracking-wider text-brand">{eyebrow}</span>}
      <h2 className={cn('mt-2 font-heading text-3xl font-semibold sm:text-4xl', light ? 'text-white' : 'text-navy dark:text-white')}>{title}</h2>
      {sub && <p className={cn('mt-3', light ? 'text-slate-300' : 'text-muted')}>{sub}</p>}
    </div>
  );
}

/** Payment Protection · Money-Back Guarantee · Verified Freelancers · Urdu/English support */
export function TrustBar({ className, compact }: { className?: string; compact?: boolean }) {
  const { t, isUr } = useLang();
  const items = [
    { i: ShieldCheck, t: t('trust.protect'), d: t('trust.protectD'), to: '/trust-safety' },
    { i: RotateCcw, t: t('trust.money'), d: t('trust.moneyD'), to: '/guarantee' },
    { i: BadgeCheck, t: t('trust.verified'), d: t('trust.verifiedD'), to: '/trust-safety#verification' },
    { i: MessageCircle, t: t('trust.support'), d: t('trust.supportD'), to: '/contact' },
  ];
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)} dir={isUr ? 'rtl' : undefined}>
      {items.map((x) => (
        <Link key={x.to} to={x.to} className={cn('group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand hover:shadow-lift dark:border-navy-700 dark:bg-navy-800', compact && 'p-3')}>
          <span className="rounded-xl bg-brand-50 p-2 dark:bg-brand/15"><x.i className="h-5 w-5 text-brand" /></span>
          <span className={cn('min-w-0', isUr && 'font-urdu')}>
            <span className="block text-sm font-semibold text-navy dark:text-white">{x.t}</span>
            {!compact && <span className="block text-xs leading-relaxed text-muted">{x.d}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}

const LEVEL: Record<string, { label: string; tone: 'slate' | 'sky' | 'amber'; icon: typeof TrendingUp }> = {
  rising: { label: 'Rising Seller', tone: 'sky', icon: TrendingUp },
  top: { label: 'Top Seller', tone: 'amber', icon: Award },
};
/** Seller level + Founding Freelancer badges (only shown when earned). */
export function SellerBadges({ p, className, showNew }: { p: Partial<Pick<Profile, 'seller_level' | 'founding_until' | 'is_verified'>>; className?: string; showNew?: boolean }) {
  const lvl = p.seller_level && LEVEL[p.seller_level];
  if (!lvl && !p.founding_until && !(showNew && p.seller_level === 'new')) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {lvl && <Badge tone={lvl.tone}><lvl.icon className="h-3 w-3" />{lvl.label}</Badge>}
      {showNew && p.seller_level === 'new' && <Badge>New Seller</Badge>}
      {p.founding_until && <Badge tone="brand"><Sparkles className="h-3 w-3" />Founding Freelancer</Badge>}
    </span>
  );
}

/** Floating WhatsApp button (bottom-left so it never covers chat or toasts). */
export function WhatsAppFloat() {
  const c = useSiteContact();
  const { t } = useLang();
  return (
    <a href={waLink(c.whatsapp, 'Assalam o Alaikum! I have a question about HN Creative Agency.')} target="_blank" rel="noopener noreferrer"
      onClick={() => track('contact', { method: 'whatsapp' })}
      className="fixed bottom-5 left-4 z-[60] flex h-12 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:scale-105 sm:bottom-6 sm:left-6"
      aria-label={t('whatsapp')} style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2z" /></svg>
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}

/** Interactive fee example: what the client pays and what the freelancer receives. */
export function FeeCalculator({ className }: { className?: string }) {
  const s = usePublicSettings();
  const [price, setPrice] = useState(15000);
  const e = estimate(price, s);
  const threshold = s?.client_fee_free_threshold ?? 5000;
  return (
    <Card className={cn('p-6', className)}>
      <label htmlFor="fee-price" className="text-sm font-medium">Order price</label>
      <div className="mt-2 flex items-center gap-3">
        <input id="fee-price" type="range" min={500} max={100000} step={500} value={price} onChange={(x) => setPrice(Number(x.target.value))} className="h-2 flex-1 accent-brand" />
        <span className="w-28 text-right font-heading text-lg font-semibold">{money(price)}</span>
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-navy-900">
          <dt className="text-xs text-muted">Client pays</dt>
          <dd className="font-heading text-2xl font-semibold">{money(e.clientPays)}</dd>
          <dd className="mt-1 text-xs text-muted">{e.fee === 0 ? `No service fee up to ${money(threshold)}` : `incl. ${pct(s?.client_service_fee_rate ?? 0.03)} service fee (${money(e.fee)})`}</dd>
        </div>
        <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
          <dt className="text-xs text-muted">Freelancer receives</dt>
          <dd className="font-heading text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{money(e.freelancerGets)}</dd>
          <dd className="mt-1 text-xs text-muted">after {pct(s?.commission_rate ?? 0.1)} commission · Founding Freelancers pay {pct(s?.founding_program.commission_rate ?? 0)}</dd>
        </div>
      </dl>
    </Card>
  );
}

export const LEAD_SERVICES = ['Logo & Branding', 'Website / Shopify store', 'Social media management', 'Video editing', 'Ads (Meta / Google / TikTok)', 'Full brand launch', 'Other'];
const TIMES = ['10:00 – 11:00', '11:00 – 12:00', '12:00 – 13:00', '14:00 – 15:00', '15:00 – 16:00', '16:00 – 17:00', '17:00 – 18:00'];

/** Lead capture for free consultations, managed projects and agency packages. */
export function LeadForm({ kind, packageName, onDone, compact }: { kind: 'consultation' | 'managed_project' | 'agency_package'; packageName?: string; onDone?: () => void; compact?: boolean }) {
  const toast = useToast();
  const { user, profile } = useAuth();
  const s = usePublicSettings();
  const today = new Date(); today.setDate(today.getDate() + 1);
  const minDate = today.toISOString().slice(0, 10);
  const [f, setF] = useState({ name: profile?.full_name ?? '', email: user?.email ?? '', phone: '', company: '', service: '', budget: '', preferred_date: '', preferred_time: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = 'Enter your name';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) er.email = 'Enter a valid email';
    if (f.phone && !/^[+\d][\d\s-]{9,15}$/.test(f.phone.trim())) er.phone = 'Enter a valid phone number, e.g. 0300 1234567';
    if (kind === 'consultation' && !f.preferred_date) er.preferred_date = 'Choose a day';
    if (kind === 'managed_project' && f.message.trim().length < 20) er.message = 'Tell us a little about the project (at least 20 characters)';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const { error } = await supabase.from('leads').insert({
      kind, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || null, company: f.company.trim() || null,
      service: f.service || null, package: packageName ?? null, budget: f.budget || null,
      preferred_date: f.preferred_date || null, preferred_time: f.preferred_time || null, message: f.message.trim() || null, user_id: user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    track('lead', { kind, package: packageName });
    setSent(true); onDone?.();
  };

  if (sent) return (
    <div className="py-8 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
      <p className="mt-3 font-heading text-xl font-semibold">Thank you, {f.name.split(' ')[0]}!</p>
      <p className="mt-2 text-sm text-muted">{kind === 'consultation' ? 'We’ll confirm your consultation time by email or WhatsApp within one business day.' : 'Our team will contact you within one business day with next steps and a clear quote.'}</p>
    </div>
  );
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {packageName && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand/10 dark:text-brand-200">Package: <b>{packageName}</b></p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id={`${kind}-name`} label="Your name" value={f.name} onChange={(e) => up('name', e.target.value)} error={errors.name} required maxLength={80} />
        <Input id={`${kind}-email`} label="Email" type="email" value={f.email} onChange={(e) => up('email', e.target.value)} error={errors.email} required maxLength={120} />
        <Input id={`${kind}-phone`} label="WhatsApp / phone" placeholder="0300 1234567" value={f.phone} onChange={(e) => up('phone', e.target.value)} error={errors.phone} maxLength={20} />
        <Input id={`${kind}-company`} label="Business name" value={f.company} onChange={(e) => up('company', e.target.value)} maxLength={100} />
      </div>
      {!packageName && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select id={`${kind}-service`} label="What do you need?" value={f.service} onChange={(e) => up('service', e.target.value)}>
            <option value="">Select a service</option>{LEAD_SERVICES.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select id={`${kind}-budget`} label="Budget (PKR)" value={f.budget} onChange={(e) => up('budget', e.target.value)}>
            <option value="">Not sure yet</option>{['Under 15,000', '15,000 – 50,000', '50,000 – 150,000', '150,000+'].map((x) => <option key={x}>{x}</option>)}
          </Select>
        </div>
      )}
      {kind === 'consultation' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="consult-date" label="Preferred day" type="date" min={minDate} value={f.preferred_date} onChange={(e) => up('preferred_date', e.target.value)} error={errors.preferred_date} required />
          <Select id="consult-time" label="Preferred time (PKT)" value={f.preferred_time} onChange={(e) => up('preferred_time', e.target.value)}>
            <option value="">Any time</option>{TIMES.map((x) => <option key={x}>{x}</option>)}
          </Select>
        </div>
      )}
      {!compact && (
        <Textarea id={`${kind}-message`} label={kind === 'managed_project' ? 'Project details' : 'Anything we should know? (optional)'} rows={4} value={f.message}
          onChange={(e) => up('message', e.target.value)} error={errors.message} maxLength={4000} required={kind === 'managed_project'} />
      )}
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {kind === 'consultation' ? <><CalendarDays className="h-4 w-4" />Book free consultation</> : kind === 'managed_project' ? 'Request a managed project' : 'Request this package'}
      </Button>
      {kind === 'consultation' && s?.booking_url && (
        <p className="text-center text-sm text-muted">Prefer to pick a slot yourself? <a href={s.booking_url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand">Open our booking calendar</a></p>
      )}
      <p className="text-center text-xs text-muted">Free, no obligation. We reply within one business day.</p>
    </form>
  );
}

/** Basic / Standard / Premium price guide for a service. */
export function TierGrid({ tiers, monthly }: { tiers: { name: string; price: number; includes: string }[]; monthly?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {tiers.map((t, i) => (
        <Card key={t.name} className={cn('flex flex-col p-6', i === 1 && 'border-brand ring-2 ring-brand')}>
          <div className="flex items-center justify-between"><p className="font-heading font-semibold">{t.name}</p>{i === 1 && <Badge tone="brand">Most popular</Badge>}</div>
          <p className="mt-3 font-heading text-3xl font-bold text-navy dark:text-white">{money(t.price)}<span className="text-sm font-normal text-muted">{monthly ? '/month' : ''}</span></p>
          <p className="mt-2 text-sm text-muted">{t.includes}</p>
        </Card>
      ))}
    </div>
  );
}

/** Prominent guarantee panel used on gig, checkout and pricing pages. */
export function GuaranteeNote({ className }: { className?: string }) {
  return (
    <div className={cn('flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200', className)}>
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
      <p><b>Work done or your money back.</b> Your payment is held until you approve the delivery. <Link to="/guarantee" className="font-medium underline">How it works</Link></p>
    </div>
  );
}
