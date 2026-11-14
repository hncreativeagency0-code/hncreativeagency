import { Link } from 'react-router-dom';
import { Briefcase, Clock, CheckCircle2, Wallet, Star, ShoppingBag, AlertCircle, ArrowRight, Hourglass, Receipt, PlusCircle, FileText, Gift, BadgeCheck, BarChart3, Sparkles, TrendingUp, Award } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAsync, usePublicSettings, q } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import type { Order, Profile } from '@/lib/types';
import { Avatar, ButtonLink, Card, EmptyState, ErrorBox, PageHeader, Skeleton, StatCard } from '@/components/ui';
import { OrderStatusBadge } from '@/components/cards';
import { cn, date, money, timeLeft } from '@/lib/utils';
import { pct } from '@/lib/fees';

export const ORDER_LIST_SELECT = '*, client:profiles!orders_client_id_fkey(id,full_name,avatar_url), freelancer:profiles!orders_freelancer_id_fkey(id,full_name,avatar_url)';

export function OrderRow({ o, viewer }: { o: Order; viewer: 'client' | 'freelancer' | 'admin' }) {
  const other = viewer === 'client' ? o.freelancer : o.client;
  const tl = ['active', 'revision_requested'].includes(o.status) ? timeLeft(o.due_at) : null;
  return (
    <Link to={viewer === 'admin' ? `/admin/orders/${o.id}` : `/app/orders/${o.id}`}
      className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 transition last:border-0 hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-navy-700/40 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar url={other?.avatar_url} name={other?.full_name} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-navy dark:text-white">{o.title}</p>
          <p className="text-xs text-muted">{o.order_number} · {viewer === 'admin' ? `${o.client?.full_name} → ${o.freelancer?.full_name}` : other?.full_name}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        {tl && <span className={cn('text-xs font-medium', tl.late ? 'text-red-500' : 'text-muted')}>{tl.label}</span>}
        <span className="text-sm font-semibold">{money(viewer === 'freelancer' ? o.freelancer_earning : o.total_amount)}</span>
        <OrderStatusBadge s={o.status} />
      </div>
    </Link>
  );
}

function completion(p: Profile) {
  const checks = [!!p.avatar_url, !!p.title, (p.bio ?? '').length >= 80, p.skills.length >= 3, p.languages.length > 0, p.years_experience != null, p.education.length + p.certifications.length > 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function ClientDashboard() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const orders = await q(supabase.from('orders').select(ORDER_LIST_SELECT).eq('client_id', profile!.id).order('updated_at', { ascending: false }).limit(100)) as Order[];
    return orders;
  }, [profile?.id]);
  const orders = data ?? [];
  const by = (s: string[]) => orders.filter((o) => s.includes(o.status));
  const spent = orders.filter((o) => o.payment_status === 'paid' || o.status === 'completed').reduce((a, o) => a + Number(o.total_amount), 0);
  const needsAction = orders.filter((o) => o.status === 'delivered' || (o.status === 'pending_payment' && ['unpaid', 'rejected'].includes(o.payment_status)));
  return (
    <>
      <PageHeader title={`Welcome, ${profile!.full_name.split(' ')[0] || 'there'}`} subtitle="Here's what's happening with your projects." action={<ButtonLink to="/explore"><ShoppingBag className="h-4 w-4" />Find services</ButtonLink>} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          { to: '/post-request', i: FileText, t: 'Post a request', d: 'Get proposals from freelancers' },
          { to: '/agency#pricing', i: Briefcase, t: 'Hire the agency', d: 'Managed packages from PKR 3,000' },
          { to: '/app/settings?tab=referrals', i: Gift, t: 'Invite a friend', d: 'You both get a credit' },
        ].map((x) => (
          <Link key={x.to} to={x.to} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand dark:border-navy-700 dark:bg-navy-800">
            <span className="rounded-xl bg-brand-50 p-2.5 dark:bg-brand/15"><x.i className="h-5 w-5 text-brand" /></span>
            <span><span className="block text-sm font-semibold group-hover:text-brand">{x.t}</span><span className="block text-xs text-muted">{x.d}</span></span>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : <>
          <StatCard label="Active orders" value={by(['active', 'revision_requested', 'pending_acceptance']).length} icon={Briefcase} />
          <StatCard label="Awaiting your review" value={by(['delivered']).length} icon={AlertCircle} />
          <StatCard label="Completed" value={by(['completed']).length} icon={CheckCircle2} />
          <StatCard label="Total spent" value={money(spent)} icon={Receipt} />
        </>}
      </div>
      {needsAction.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-slate-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-navy-700 dark:bg-amber-500/10 dark:text-amber-300">Needs your attention</div>
          {needsAction.map((o) => <OrderRow key={o.id} o={o} viewer="client" />)}
        </Card>
      )}
      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-navy-700">
          <h2 className="font-heading font-semibold">Recent orders</h2>
          <Link to="/app/orders" className="flex items-center gap-1 text-sm font-medium text-brand">All orders<ArrowRight className="h-4 w-4" /></Link>
        </div>
        {loading ? <div className="p-4"><Skeleton className="h-32" /></div> : orders.length === 0
          ? <div className="p-6"><EmptyState icon={Briefcase} title="No orders yet" text="Browse services or send a custom request to a freelancer." action={<ButtonLink to="/explore">Explore gigs</ButtonLink>} /></div>
          : orders.slice(0, 6).map((o) => <OrderRow key={o.id} o={o} viewer="client" />)}
      </Card>
    </>
  );
}

/** Seller level progress, Founding badge and verification prompt. */
function LevelCard() {
  const { profile } = useAuth();
  const s = usePublicSettings();
  if (!profile) return null;
  const rules = s?.seller_level_rules ?? { rising: { orders: 5, rating: 4.5 }, top: { orders: 25, rating: 4.7, reviews: 10 } };
  const lvl = profile.seller_level ?? 'new';
  const nextName = lvl === 'new' ? 'Rising Seller' : lvl === 'rising' ? 'Top Seller' : null;
  const target = lvl === 'new' ? rules.rising.orders : rules.top.orders;
  const progress = Math.min(100, Math.round((profile.completed_orders / target) * 100));
  const rate = profile.founding_until && new Date(profile.founding_until) > new Date() ? s?.founding_program.commission_rate ?? 0
    : lvl === 'top' ? s?.level_commission.top ?? 0.08 : lvl === 'rising' ? s?.level_commission.rising ?? 0.09 : s?.commission_rate ?? 0.1;
  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-heading font-semibold">{lvl === 'top' ? <Award className="h-5 w-5 text-amber-500" /> : <TrendingUp className="h-5 w-5 text-sky-500" />}{lvl === 'new' ? 'New Seller' : lvl === 'rising' ? 'Rising Seller' : 'Top Seller'}</p>
          <span className="text-sm text-muted">Your commission: <b className="text-navy dark:text-white">{pct(rate)}</b></span>
        </div>
        {nextName ? (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-700"><div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} /></div>
            <p className="mt-2 text-xs text-muted">{profile.completed_orders}/{target} completed orders{lvl === 'rising' && ` · ${rules.top.rating}★+ rating and ${rules.top.reviews}+ reviews`} to become a <b>{nextName}</b> — higher ranking and lower commission.</p>
          </>
        ) : <p className="mt-2 text-sm text-muted">You’re at the top level. Your gigs get priority placement.</p>}
        {profile.founding_until && <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand/15 dark:text-brand-200"><Sparkles className="h-3.5 w-3.5" />Founding Freelancer{new Date(profile.founding_until) > new Date() ? ` · ${pct(s?.founding_program.commission_rate ?? 0)} commission until ${date(profile.founding_until)}` : ''}</p>}
      </Card>
      <Card className="flex flex-col justify-between gap-3 p-5">
        {profile.is_verified ? (
          <p className="flex items-center gap-2 text-sm font-medium"><BadgeCheck className="h-5 w-5 text-brand" />You’re verified</p>
        ) : (
          <div><p className="flex items-center gap-2 text-sm font-semibold"><BadgeCheck className="h-5 w-5 text-brand" />Get verified</p><p className="mt-1 text-xs text-muted">Verified freelancers win more orders.</p></div>
        )}
        <div className="flex flex-wrap gap-2">
          {!profile.is_verified && <ButtonLink to="/app/settings?tab=verification" size="sm">Verify now</ButtonLink>}
          <ButtonLink to="/app/analytics" size="sm" variant="outline"><BarChart3 className="h-4 w-4" />Analytics</ButtonLink>
          <ButtonLink to="/jobs" size="sm" variant="outline"><FileText className="h-4 w-4" />Requests</ButtonLink>
        </div>
      </Card>
    </div>
  );
}

function FreelancerDashboard() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    await rpc('release_cleared_earnings').catch(() => 0);
    const [orders, wallet, gigs] = await Promise.all([
      q(supabase.from('orders').select(ORDER_LIST_SELECT).eq('freelancer_id', profile!.id).neq('status', 'pending_payment').order('updated_at', { ascending: false }).limit(200)),
      rpc<{ pending: number; available: number; total_earned: number }[]>('get_wallet_summary'),
      q(supabase.from('gigs').select('id,status').eq('freelancer_id', profile!.id)),
    ]);
    return { orders: orders as Order[], wallet: wallet[0], gigs: gigs as { id: string; status: string }[] };
  }, [profile?.id]);
  const pctDone = completion(profile!);
  const orders = data?.orders ?? [];
  const by = (s: string[]) => orders.filter((o) => s.includes(o.status));
  const deadlines = by(['active', 'revision_requested']).sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''));
  return (
    <>
      <PageHeader title={`Welcome, ${profile!.full_name.split(' ')[0] || 'there'}`} subtitle="Your orders, earnings and gigs at a glance."
        action={<ButtonLink to="/app/gigs/new"><PlusCircle className="h-4 w-4" />Create gig</ButtonLink>} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {pctDone < 100 && (
        <Card className="mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-semibold">Profile {pctDone}% complete</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-700"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pctDone}%` }} /></div>
          </div>
          <ButtonLink to="/app/settings" variant="outline" size="sm">Complete profile</ButtonLink>
        </Card>
      )}
      <LevelCard />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : <>
          <StatCard label="Available balance" value={money(data?.wallet?.available)} icon={Wallet} hint={`${money(data?.wallet?.pending)} pending clearance`} />
          <StatCard label="Active orders" value={by(['active', 'revision_requested']).length} icon={Briefcase} hint={`${by(['delivered']).length} awaiting client review`} />
          <StatCard label="Completed orders" value={profile!.completed_orders} icon={CheckCircle2} hint={`${money(data?.wallet?.total_earned)} earned in total`} />
          <StatCard label="Rating" value={profile!.rating_count ? Number(profile!.rating_avg).toFixed(1) : '—'} icon={Star} hint={`${profile!.rating_count} review${profile!.rating_count === 1 ? '' : 's'} · ${data?.gigs.filter((g) => g.status === 'published').length ?? 0} live gigs`} />
        </>}
      </div>

      {by(['pending_acceptance']).length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-slate-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:border-navy-700 dark:bg-brand/10 dark:text-brand-200">New order requests — accept to start</div>
          {by(['pending_acceptance']).map((o) => <OrderRow key={o.id} o={o} viewer="freelancer" />)}
        </Card>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-navy-700"><Clock className="h-4 w-4 text-brand" /><h2 className="font-heading font-semibold">Upcoming deadlines</h2></div>
          {deadlines.length ? deadlines.slice(0, 6).map((o) => <OrderRow key={o.id} o={o} viewer="freelancer" />) : <p className="p-6 text-sm text-muted">No active deadlines.</p>}
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-navy-700"><Hourglass className="h-4 w-4 text-brand" /><h2 className="font-heading font-semibold">Recent activity</h2></div>
          {orders.length ? orders.slice(0, 6).map((o) => <OrderRow key={o.id} o={o} viewer="freelancer" />)
            : <div className="p-6"><EmptyState icon={ShoppingBag} title="No orders yet" text="Publish a gig so clients can find you." action={<ButtonLink to="/app/gigs/new" size="sm">Create a gig</ButtonLink>} /></div>}
        </Card>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === 'freelancer' ? <FreelancerDashboard /> : <ClientDashboard />;
}
