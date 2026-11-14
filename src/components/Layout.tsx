import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Menu, X, Moon, Sun, MessageSquare, LayoutDashboard, LogOut, Settings, User, Briefcase, ShoppingBag, Wallet,
  Heart, Star, Shield, FolderOpen, PlusCircle, Receipt, LifeBuoy, Users, Tags, CreditCard, ArrowDownToLine, Gavel, Flag, Cog,
  Mail, Phone, MapPin, Monitor, Languages, FileText, BarChart3, Send, Ticket, BadgeCheck, Inbox,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Avatar, LegacyImg, Monogram, PageLoader, Badge } from './ui';
import { cn, timeAgo } from '@/lib/utils';
import { DEMO } from '@/lib/supabase';
import type { Role } from '@/lib/types';
import { useLang, type TKey } from '@/context/LangContext';
import { useSiteContact } from '@/lib/site';
import { trackPage } from '@/lib/analytics';
import { WhatsAppFloat } from './marketing';

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <button onClick={() => setLang(lang === 'en' ? 'ur' : 'en')} aria-label={lang === 'en' ? 'Switch to Urdu' : 'Switch to English'} title={lang === 'en' ? 'اردو میں دیکھیں' : 'View in English'}
      className={cn('inline-flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-medium text-muted transition hover:bg-slate-100 hover:text-navy dark:hover:bg-navy-800 dark:hover:text-white', className)}>
      <Languages className="h-4 w-4" /><span className={lang === 'en' ? 'font-urdu text-[13px]' : ''}>{t('lang.toggle')}</span>
    </button>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="HN Creative Agency home">
      <LegacyImg src="/assets/images/favicon.png" alt="" className="h-9 w-9 rounded-lg object-contain" fallback={<Monogram className="h-9 w-9" />} />
      {!compact && (
        <span className="leading-tight">
          <span className="block font-heading text-[15px] font-semibold text-navy dark:text-white">HN Creative Agency</span>
          <span className="block text-[11px] tracking-wide text-muted">Design. Market. Grow.</span>
        </span>
      )}
    </Link>
  );
}

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
  return (
    <button onClick={() => setMode(next)} title={`Theme: ${mode} (click for ${next})`} aria-label={`Switch to ${next} theme`}
      className="rounded-xl p-2 text-muted transition hover:bg-slate-100 hover:text-navy dark:hover:bg-navy-800 dark:hover:text-white">
      <Icon className="h-5 w-5" />
    </button>
  );
}

function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOut]);
  return ref;
}

function NotificationBell() {
  const { notifications, unread, markRead } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const nav = useNavigate();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative rounded-xl p-2 text-muted hover:bg-slate-100 hover:text-navy dark:hover:bg-navy-800 dark:hover:text-white" aria-label={`Notifications (${unread} unread)`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fadein rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-navy-700 dark:bg-navy-800">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-navy-700">
            <span className="font-heading text-sm font-semibold">Notifications</span>
            {unread > 0 && <button onClick={() => markRead()} className="text-xs font-medium text-brand">Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && <p className="p-6 text-center text-sm text-muted">You're all caught up.</p>}
            {notifications.slice(0, 12).map((n) => (
              <button key={n.id} onClick={() => { markRead(n.id); setOpen(false); if (n.link) nav(n.link); }}
                className={cn('block w-full border-b border-slate-50 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 dark:border-navy-700/50 dark:hover:bg-navy-700/50', !n.is_read && 'bg-brand-50/60 dark:bg-brand/5')}>
                <div className="flex items-start gap-2">
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy dark:text-white">{n.title}</p>
                    {n.body && <p className="truncate text-xs text-muted">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-muted">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Link to="/app/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 py-2.5 text-center text-sm font-medium text-brand dark:border-navy-700">View all</Link>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const nav = useNavigate();
  if (!profile) return null;
  const items = [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
    ...(profile.role === 'freelancer' ? [{ to: `/freelancers/${profile.id}`, label: 'Public profile', icon: User }] : []),
    ...(profile.role === 'admin' ? [{ to: '/admin', label: 'Admin panel', icon: Shield }] : []),
    { to: '/app/settings', label: 'Account settings', icon: Settings },
  ];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center rounded-full ring-brand/40 transition hover:ring-2" aria-label="Account menu">
        <Avatar url={profile.avatar_url} name={profile.full_name} size={34} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 animate-fadein rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-navy-700 dark:bg-navy-800">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{profile.full_name || 'Your account'}</p>
            <p className="text-xs capitalize text-muted">{profile.role}</p>
          </div>
          {items.map((i) => (
            <Link key={i.to} to={i.to} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-navy-700">
              <i.icon className="h-4 w-4 text-muted" />{i.label}
            </Link>
          ))}
          <button onClick={async () => { await signOut(); nav('/'); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
            <LogOut className="h-4 w-4" />Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const publicLinks: { to: string; key: TKey }[] = [
  { to: '/explore', key: 'nav.explore' },
  { to: '/freelancers', key: 'nav.freelancers' },
  { to: '/jobs', key: 'nav.jobs' },
  { to: '/agency', key: 'nav.agency' },
  { to: '/pricing', key: 'nav.pricing' },
];

export function Navbar() {
  const { user, profile } = useAuth();
  const { t, isUr } = useLang();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  const ur = isUr ? 'font-urdu' : '';
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg dark:border-navy-800 dark:bg-navy-900/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {publicLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => cn('rounded-xl px-3 py-2 text-sm font-medium transition', ur, isActive ? 'text-brand' : 'text-navy/80 hover:text-brand dark:text-slate-300')}>{t(l.key)}</NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <LangToggle className="hidden sm:inline-flex" />
          <ThemeToggle />
          {user ? (
            <>
              <Link to="/app/messages" className="rounded-xl p-2 text-muted hover:bg-slate-100 hover:text-navy dark:hover:bg-navy-800 dark:hover:text-white" aria-label="Messages"><MessageSquare className="h-5 w-5" /></Link>
              <NotificationBell />
              <span className="ml-1"><UserMenu /></span>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login" className={cn('px-3 text-sm font-medium text-navy hover:text-brand dark:text-slate-200', ur)}>{t('nav.signin')}</Link>
              <Link to="/register" className={cn('rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600', ur)}>{t('nav.join')}</Link>
            </div>
          )}
          <button onClick={() => setOpen(!open)} className="rounded-xl p-2 lg:hidden" aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-navy-800 dark:bg-navy-900 lg:hidden">
          {publicLinks.map((l) => <Link key={l.to} to={l.to} className={cn('block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-navy-800', ur)}>{t(l.key)}</Link>)}
          <Link to="/how-it-works" className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-navy-800">How it works</Link>
          <LangToggle className="w-full justify-start px-3 sm:hidden" />
          {user ? (
            <Link to={profile?.role === 'admin' ? '/admin' : '/app'} className={cn('mt-2 block rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-medium text-white', ur)}>{t('nav.dashboard')}</Link>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link to="/login" className={cn('rounded-xl border border-slate-300 py-2.5 text-center text-sm font-medium dark:border-navy-700', ur)}>{t('nav.signin')}</Link>
              <Link to="/register" className={cn('rounded-xl bg-brand py-2.5 text-center text-sm font-medium text-white', ur)}>{t('nav.join')}</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export const SOCIALS = [
  { href: 'https://www.facebook.com/profile.php?id=61591137246680', slug: 'facebook', label: 'Facebook' },
  { href: 'https://www.instagram.com/hn.creativeagency/', slug: 'instagram', label: 'Instagram' },
  { href: 'https://www.linkedin.com/in/hn-creative-agency-492362420/', slug: 'linkedin', label: 'LinkedIn' },
  { href: 'https://x.com/hncreativeagen', slug: 'x', label: 'X' },
  { href: 'https://www.pinterest.com/hncreativeagency/_profile/', slug: 'pinterest', label: 'Pinterest' },
  { href: 'https://www.youtube.com/@HNCreativeAgency', slug: 'youtube', label: 'YouTube' },
  { href: 'https://www.tiktok.com/@hncreativeagency0', slug: 'tiktok', label: 'TikTok' },
];

/** Brand logos from Simple Icons (same source the original site used). */
export function BrandIcon({ slug, color = 'ffffff', className = 'h-4 w-4' }: { slug: string; color?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={cn(className, 'inline-flex items-center justify-center text-[10px] font-bold uppercase leading-none')} style={{ color: `#${color}` }}>{slug.slice(0, 2)}</span>;
  return <img src={`https://cdn.simpleicons.org/${slug}/${color}`} alt="" className={className} loading="lazy" onError={() => setFailed(true)} />;
}

export function Footer() {
  const c = useSiteContact();
  const { t, isUr } = useLang();
  return (
    <footer className="mt-20 bg-navy text-slate-300 dark:bg-navy-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <LegacyImg src="/assets/images/favicon.png" alt="" className="h-10 w-10 rounded-lg object-contain" fallback={<Monogram className="h-10 w-10" />} />
            <span className="font-heading text-lg font-semibold text-white">HN Creative Agency</span>
          </div>
          <p className={cn('mt-3 max-w-sm text-sm leading-relaxed text-slate-400', isUr && 'font-urdu leading-[2]')} dir={isUr ? 'rtl' : undefined}>{t('footer.about')}</p>
          <p className="mt-3 font-heading text-sm font-medium text-brand-300">Design. Market. Grow.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SOCIALS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="rounded-xl bg-white/5 p-2 transition hover:bg-brand"><BrandIcon slug={s.slug} /></a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-heading text-sm font-semibold text-white">Hire</h4>
          <ul className="mt-3 space-y-2 text-sm">
            {[['/explore', 'Explore services'], ['/services/logo-design', 'Logo design'], ['/services/website-development', 'Website development'], ['/services/video-editing', 'Video editing'], ['/services/social-media-marketing', 'Social media'], ['/services/ads-management', 'Ads management'], ['/post-request', 'Post a request'], ['/managed-projects', 'Managed projects']].map(([to, l]) => (
              <li key={to}><Link to={to} className="hover:text-white">{l}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-heading text-sm font-semibold text-white">Trust & company</h4>
          <ul className="mt-3 space-y-2 text-sm">
            {[['/pricing', 'Pricing & fees'], ['/guarantee', 'Money-back guarantee'], ['/trust-safety', 'Trust & safety'], ['/case-studies', 'Case studies'], ['/blog', 'Blog'], ['/agency', 'Our agency'], ['/about', 'About us'], ['/register?role=freelancer', 'Become a freelancer'], ['/help', 'Help center']].map(([to, l]) => (
              <li key={to}><Link to={to} className="hover:text-white">{l}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-heading text-sm font-semibold text-white">Contact</h4>
          <ul className="mt-3 space-y-2.5 text-sm">
            <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0 text-brand-300" /><a href={`mailto:${c.email}`} className="break-all hover:text-white">{c.email}</a></li>
            <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-brand-300" /><a href={c.whatsappUrl} className="hover:text-white">{c.phone} (WhatsApp)</a></li>
            <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-brand-300" />{c.address}</li>
            <li className="text-xs text-slate-500">Support: {c.hours}</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-1.5 text-[11px] font-medium text-slate-300">
            {['JazzCash', 'Easypaisa', 'Raast', 'Bank transfer'].map((m) => <span key={m} className="rounded-md border border-white/10 px-2 py-1">{m}</span>)}
          </div>
        </div>
      </div>
      <div className={cn('flex flex-col items-center justify-center gap-2 border-t border-white/10 px-4 py-5 text-center text-xs text-slate-500 sm:flex-row sm:gap-4', DEMO && 'pb-20')}>
        <span>© {new Date().getFullYear()} HN Creative Agency · Serving Pakistan · Prices in PKR</span>
        <span className="flex gap-3"><Link to="/terms" className="hover:text-white">Terms</Link><Link to="/privacy" className="hover:text-white">Privacy</Link><Link to="/refund-policy" className="hover:text-white">Refunds</Link></span>
      </div>
    </footer>
  );
}

/** Sends a page view to analytics on every route change. */
export function RouteTracker() {
  const { pathname } = useLocation();
  useEffect(() => { const id = setTimeout(() => trackPage(pathname), 50); return () => clearTimeout(id); }, [pathname]);
  return null;
}

export function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => { if (!window.location.hash) window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <Navbar />
      <main id="main" className="flex-1"><Outlet /></main>
      <Footer />
      {!DEMO && <WhatsAppFloat />}
    </div>
  );
}

export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, profile, loading, needsMfa } = useAuth();
  const loc = useLocation();
  if (loading || (user && !profile)) return <PageLoader />;
  if (!user || needsMfa) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (profile && !profile.profile_completed && profile.role !== 'admin' && !loc.pathname.startsWith('/app/onboarding')) return <Navigate to="/app/onboarding" replace />;
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean };
const NAV: Record<Role, NavItem[]> = {
  client: [
    { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/explore', label: 'Browse gigs', icon: ShoppingBag },
    { to: '/app/requests', label: 'My requests', icon: FileText },
    { to: '/app/orders', label: 'My orders', icon: Briefcase },
    { to: '/app/messages', label: 'Messages', icon: MessageSquare },
    { to: '/app/saved', label: 'Saved', icon: Heart },
    { to: '/app/payments', label: 'Payments & credits', icon: Receipt },
    { to: '/app/reviews', label: 'Reviews', icon: Star },
    { to: '/app/support', label: 'Support & disputes', icon: LifeBuoy },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ],
  freelancer: [
    { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/app/gigs', label: 'My gigs', icon: ShoppingBag },
    { to: '/app/gigs/new', label: 'Create gig', icon: PlusCircle },
    { to: '/app/analytics', label: 'Gig analytics', icon: BarChart3 },
    { to: '/jobs', label: 'Find requests', icon: Inbox },
    { to: '/app/proposals', label: 'My proposals', icon: Send },
    { to: '/app/portfolio', label: 'Portfolio', icon: FolderOpen },
    { to: '/app/orders', label: 'Orders', icon: Briefcase },
    { to: '/app/messages', label: 'Messages', icon: MessageSquare },
    { to: '/app/wallet', label: 'Earnings & wallet', icon: Wallet },
    { to: '/app/reviews', label: 'Reviews', icon: Star },
    { to: '/app/support', label: 'Support & disputes', icon: LifeBuoy },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ],
  admin: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/gigs', label: 'Gigs', icon: ShoppingBag },
    { to: '/admin/categories', label: 'Categories', icon: Tags },
    { to: '/admin/leads', label: 'Leads & bookings', icon: Inbox },
    { to: '/admin/verification', label: 'Verification', icon: BadgeCheck },
    { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
    { to: '/admin/jobs', label: 'Requests', icon: FileText },
    { to: '/admin/orders', label: 'Orders', icon: Briefcase },
    { to: '/admin/payments', label: 'Payments & refunds', icon: CreditCard },
    { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowDownToLine },
    { to: '/admin/disputes', label: 'Disputes', icon: Gavel },
    { to: '/admin/reports', label: 'Reports & reviews', icon: Flag },
    { to: '/admin/logs', label: 'Transactions & logs', icon: Receipt },
    { to: '/admin/settings', label: 'Settings', icon: Cog },
    { to: '/app/messages', label: 'Messages', icon: MessageSquare },
  ],
};

export function DashboardLayout({ area }: { area: 'app' | 'admin' }) {
  const { profile } = useAuth();
  const contact = useSiteContact();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  if (!profile) return <PageLoader />;
  const items = NAV[area === 'admin' ? 'admin' : profile.role];
  const fullBleed = loc.pathname.startsWith('/app/messages');
  const side = (
    <nav className="space-y-0.5">
      {area === 'app' && profile.role === 'admin' && (
        <Link to="/admin" className="mb-3 flex items-center gap-2 rounded-xl bg-navy px-3 py-2 text-sm font-medium text-white dark:bg-brand"><Shield className="h-4 w-4" />Admin panel</Link>
      )}
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end}
          className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
            isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand/15 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800')}>
          <i.icon className="h-4 w-4" />{i.label}
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      {profile.status === 'suspended' && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm text-white">Your account is suspended. You can view your history but cannot take new actions. Contact {contact.email}.</div>
      )}
      <div className={cn('mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6', DEMO && 'pb-20')}>
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24">
            {area === 'admin' && <Badge tone="brand" className="mb-3">Administrator</Badge>}
            {side}
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <button onClick={() => setOpen(true)} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium lg:hidden dark:border-navy-700">
            <Menu className="h-4 w-4" />Menu
          </button>
          <div className={cn(!fullBleed && 'animate-fadein')}><Outlet /></div>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-[80] bg-navy/50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-72 overflow-y-auto bg-white p-4 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><Logo compact /><button onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button></div>
            {side}
          </div>
        </div>
      )}
    </div>
  );
}
