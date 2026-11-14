import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Heart, Receipt, Star, LifeBuoy, Trash2, CheckCheck, Gavel } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAsync, useFavorites, q, type PaymentChannel } from '@/lib/hooks';
import { CHANNEL_META } from './Checkout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Gig, Order, PaymentStatus, Profile, Review } from '@/lib/types';
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorBox, PageHeader, PageLoader, Tabs } from '@/components/ui';
import { FreelancerCard, GigCard, PaymentStatusBadge } from '@/components/cards';
import { cn, dateTime, money, timeAgo } from '@/lib/utils';
import { GIG_SELECT } from '../public/Home';
import { ReviewList } from '../public/GigDetail';

export function Notifications() {
  const { notifications, markRead, user } = useAuth();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const remove = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', user!.id);
    if (error) toast.error(error); else setHidden((s) => new Set(s).add(id));
  };
  const list = notifications.filter((n) => !hidden.has(n.id));
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" action={list.some((n) => !n.is_read) && <Button variant="outline" size="sm" onClick={() => markRead()}><CheckCheck className="h-4 w-4" />Mark all read</Button>} />
      <Card className="divide-y divide-slate-100 dark:divide-navy-700">
        {list.length === 0 && <div className="p-6"><EmptyState icon={Bell} title="No notifications" text="Order updates, messages and payments will show up here." /></div>}
        {list.map((n) => (
          <div key={n.id} className={cn('flex items-start gap-3 p-4', !n.is_read && 'bg-brand-50/50 dark:bg-brand/5')}>
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-brand')} />
            <div className="min-w-0 flex-1">
              {n.link ? <Link to={n.link} onClick={() => markRead(n.id)} className="font-medium hover:text-brand">{n.title}</Link> : <p className="font-medium">{n.title}</p>}
              {n.body && <p className="text-sm text-muted">{n.body}</p>}
              <p className="mt-0.5 text-xs text-muted">{timeAgo(n.created_at)}</p>
            </div>
            {!n.is_read && <button onClick={() => markRead(n.id)} className="text-xs font-medium text-brand">Mark read</button>}
            <button onClick={() => remove(n.id)} aria-label="Delete notification"><Trash2 className="h-4 w-4 text-muted hover:text-red-500" /></button>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function Saved() {
  const { user } = useAuth();
  const fav = useFavorites();
  const [tab, setTab] = useState<'gigs' | 'freelancers'>('gigs');
  const { data, loading } = useAsync(async () => {
    const [g, f] = await Promise.all([
      q(supabase.from('favorite_gigs').select(`gig:gigs(${GIG_SELECT})`).eq('user_id', user!.id).order('created_at', { ascending: false })),
      q(supabase.from('saved_freelancers').select('freelancer:profiles!saved_freelancers_freelancer_id_fkey(*)').eq('user_id', user!.id).order('created_at', { ascending: false })),
    ]);
    return {
      gigs: (g as unknown as { gig: Gig | null }[]).map((x) => x.gig).filter(Boolean) as Gig[],
      freelancers: (f as unknown as { freelancer: Profile | null }[]).map((x) => x.freelancer).filter(Boolean) as Profile[],
    };
  }, [user?.id]);
  if (loading) return <PageLoader />;
  const gigs = (data?.gigs ?? []).filter((g) => fav.ids.has(g.id));
  return (
    <div>
      <PageHeader title="Saved" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'gigs', label: 'Gigs', count: gigs.length }, { value: 'freelancers', label: 'Freelancers', count: data?.freelancers.length }]} />
      <div className="mt-5">
        {tab === 'gigs' && (gigs.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{gigs.map((g) => <GigCard key={g.id} gig={g} favorite onToggleFavorite={() => fav.toggle(g.id)} />)}</div>
          : <EmptyState icon={Heart} title="No saved gigs" text="Tap the heart on any gig to save it for later." action={<ButtonLink to="/explore">Explore gigs</ButtonLink>} />)}
        {tab === 'freelancers' && (data?.freelancers.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.freelancers.map((f) => <FreelancerCard key={f.id} f={f} />)}</div>
          : <EmptyState icon={Heart} title="No saved freelancers" action={<ButtonLink to="/freelancers">Browse freelancers</ButtonLink>} />)}
      </div>
    </div>
  );
}

interface PaymentRow { id: string; reference: string; amount: number; method: string; channel: PaymentChannel | null; status: PaymentStatus; payer_reference: string | null; rejection_reason: string | null; created_at: string; verified_at: string | null; order: { id: string; order_number: string; title: string } | null }
export function Payments() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const [payments, refunds] = await Promise.all([
      q(supabase.from('payments').select('*, order:orders(id,order_number,title)').eq('client_id', user!.id).order('created_at', { ascending: false })),
      q(supabase.from('refunds').select('*, order:orders!inner(order_number,client_id)').eq('order.client_id', user!.id).order('created_at', { ascending: false })),
    ]);
    return { payments: payments as PaymentRow[], refunds: refunds as { id: string; amount: number; status: string; reference: string | null; created_at: string; order: { order_number: string } }[] };
  }, [user?.id]);
  if (loading) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const total = data!.payments.filter((p) => p.status === 'paid').reduce((a, p) => a + Number(p.amount), 0);
  return (
    <div>
      <PageHeader title="Payments" subtitle={`Total verified payments: ${money(total)}`} action={<Link to="/app/settings?tab=referrals" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-medium hover:border-brand hover:text-brand dark:border-navy-700">My credits & coupons</Link>} />
      <Card className="overflow-x-auto">
        {data!.payments.length === 0 ? <div className="p-6"><EmptyState icon={Receipt} title="No payments yet" /></div> : (
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs uppercase text-muted dark:border-navy-700"><th className="p-3">Date</th><th className="p-3">Reference</th><th className="p-3">Order</th><th className="p-3">Status</th><th className="p-3 text-right">Amount</th></tr></thead>
            <tbody>
              {data!.payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 dark:border-navy-700/50">
                  <td className="whitespace-nowrap p-3 text-muted">{dateTime(p.created_at)}</td>
                  <td className="p-3"><span className="font-mono text-xs">{p.reference}</span>{p.payer_reference && <p className="text-xs text-muted">{CHANNEL_META[p.channel ?? 'bank'].name} · {p.payer_reference}</p>}</td>
                  <td className="p-3">{p.order && <Link to={`/app/orders/${p.order.id}`} className="text-brand">{p.order.order_number}</Link>}</td>
                  <td className="p-3"><PaymentStatusBadge s={p.status} />{p.rejection_reason && <p className="mt-1 text-xs text-red-500">{p.rejection_reason}</p>}</td>
                  <td className="p-3 text-right font-medium">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {data!.refunds.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-heading text-lg font-semibold">Refunds</h2>
          <Card className="divide-y divide-slate-100 dark:divide-navy-700">
            {data!.refunds.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 text-sm">
                <span>{r.order.order_number} · {dateTime(r.created_at)}{r.reference && <span className="text-muted"> · Ref {r.reference}</span>}</span>
                <span className="flex items-center gap-3"><Badge tone={r.status === 'processed' ? 'green' : r.status === 'pending' ? 'amber' : 'red'}>{r.status}</Badge><b>{money(r.amount)}</b></span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

export function Reviews() {
  const { profile } = useAuth();
  const isFreelancer = profile?.role === 'freelancer';
  const { data, loading, reload } = useAsync(async () => {
    const col = isFreelancer ? 'freelancer_id' : 'client_id';
    const [reviews, toReview] = await Promise.all([
      q(supabase.from('reviews').select('*, client:profiles!reviews_client_id_fkey(full_name,avatar_url)').eq(col, profile!.id).order('created_at', { ascending: false })),
      isFreelancer ? Promise.resolve([]) : q(supabase.from('orders').select('id,order_number,title,completed_at,reviews(id)').eq('client_id', profile!.id).eq('status', 'completed')),
    ]);
    return { reviews: reviews as Review[], pending: (toReview as (Order & { reviews: { id: string }[] | null })[]).filter((o) => !o.reviews?.length) };
  }, [profile?.id]);
  if (loading) return <PageLoader />;
  return (
    <div className="max-w-3xl">
      <PageHeader title={isFreelancer ? 'Reviews from clients' : 'Reviews'} subtitle={isFreelancer && profile ? `${profile.rating_count} reviews · ${Number(profile.rating_avg).toFixed(1)} average` : undefined} />
      {!isFreelancer && data!.pending.length > 0 && (
        <Card className="mb-6 divide-y divide-slate-100 dark:divide-navy-700">
          <p className="p-4 text-sm font-semibold">Waiting for your review</p>
          {data!.pending.map((o) => (
            <div key={o.id} className="flex items-center justify-between p-4 text-sm"><span>{o.title}<span className="text-muted"> · {o.order_number}</span></span>
              <Link to={`/app/orders/${o.id}`} className="inline-flex items-center gap-1 font-medium text-brand"><Star className="h-4 w-4" />Review</Link></div>
          ))}
        </Card>
      )}
      <Card className="px-5">
        {data!.reviews.length === 0 ? <div className="py-6"><EmptyState icon={Star} title="No reviews yet" /></div> : <ReviewList reviews={data!.reviews} canRespond={isFreelancer} onChanged={reload} />}
      </Card>
    </div>
  );
}

export function Support() {
  const { profile } = useAuth();
  const { data, loading } = useAsync(async () => {
    const col = profile!.role === 'freelancer' ? 'freelancer_id' : 'client_id';
    return q(supabase.from('disputes').select('*, order:orders!inner(id,order_number,title,client_id,freelancer_id)').eq(`order.${col}`, profile!.id).order('created_at', { ascending: false })) as Promise<
      { id: string; reason: string; status: string; resolution: string | null; created_at: string; order: { id: string; order_number: string; title: string } }[]>;
  }, [profile?.id]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Support & disputes" />
      <Card className="mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <LifeBuoy className="h-8 w-8 text-brand" />
        <div className="flex-1 text-sm"><p className="font-semibold">Need help?</p><p className="text-muted">For a problem with an order, open the order and choose “Open a dispute”. For anything else, contact our team.</p></div>
        <div className="flex gap-2"><ButtonLink to="/help" variant="outline" size="sm">Help center</ButtonLink><ButtonLink to="/contact" size="sm">Contact support</ButtonLink></div>
      </Card>
      <h2 className="mb-3 font-heading text-lg font-semibold">Your disputes</h2>
      {loading ? <PageLoader /> : !data?.length ? <EmptyState icon={Gavel} title="No disputes" text="Great — nothing to resolve." /> : (
        <Card className="divide-y divide-slate-100 dark:divide-navy-700">
          {data.map((d) => (
            <Link key={d.id} to={`/app/orders/${d.order.id}`} className="block p-4 hover:bg-slate-50 dark:hover:bg-navy-700/40">
              <div className="flex items-center justify-between"><p className="font-medium">{d.order.title}</p><Badge tone={['open', 'under_review'].includes(d.status) ? 'red' : 'slate'}>{d.status.replace('_', ' ')}</Badge></div>
              <p className="text-xs text-muted">{d.order.order_number} · {d.reason.replace('_', ' ')} · {dateTime(d.created_at)}</p>
              {d.resolution && <p className="mt-1 text-sm text-muted">{d.resolution}</p>}
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
