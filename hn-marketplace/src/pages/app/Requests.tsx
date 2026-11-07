import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, Plus, Clock, RefreshCw, Check, X, Eye, MousePointerClick, ShoppingCart, TrendingUp, BarChart3, Send, Ticket } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAsync, q } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { askConfirm } from '@/context/DialogContext';
import type { GigStatus, JobPost, JobProposal } from '@/lib/types';
import { Avatar, Badge, Button, ButtonLink, Card, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Stars, StatCard, Tabs, VerifiedBadge } from '@/components/ui';
import { SellerBadges, GuaranteeNote } from '@/components/marketing';
import { JobCard, JOB_SELECT, budgetLabel } from '@/pages/public/Jobs';
import { cn, money, timeAgo } from '@/lib/utils';
import { estimate } from '@/lib/fees';
import { usePublicSettings } from '@/lib/hooks';
import { track } from '@/lib/analytics';

const PROPOSAL_SELECT = '*, freelancer:profiles!job_proposals_freelancer_id_fkey(id,full_name,avatar_url,title,is_verified,rating_avg,rating_count,seller_level,founding_until)';

/* ------------------------------ Client: my requests ------------------------------ */
export function MyRequests() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'open' | 'past'>('open');
  const { data, loading, error, reload } = useAsync(() => q(supabase.from('job_posts').select(JOB_SELECT).eq('client_id', user!.id).order('created_at', { ascending: false })) as Promise<JobPost[]>, [user?.id]);
  const rows = (data ?? []).filter((j) => (tab === 'open' ? j.status === 'open' : j.status !== 'open'));
  return (
    <div>
      <PageHeader title="My requests" subtitle="Post what you need and compare proposals from freelancers." action={<ButtonLink to="/post-request"><Plus className="h-4 w-4" />Post a request</ButtonLink>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'open', label: 'Open', count: (data ?? []).filter((j) => j.status === 'open').length }, { value: 'past', label: 'Hired & closed' }]} />
      <div className="mt-4 space-y-4">
        {error && <ErrorBox message={error} onRetry={reload} />}
        {loading ? <PageLoader /> : rows.length ? rows.map((j) => <JobCardApp key={j.id} j={j} />) : (
          <EmptyState icon={FileText} title={tab === 'open' ? 'No open requests' : 'Nothing here yet'} text="Describe your project and freelancers will send you proposals with prices and timelines."
            action={<ButtonLink to="/post-request">Post a request</ButtonLink>} />
        )}
      </div>
    </div>
  );
}
function JobCardApp({ j }: { j: JobPost }) {
  return (
    <Link to={`/app/requests/${j.id}`} className="group block">
      <Card className="flex flex-col gap-3 p-5 transition group-hover:border-brand sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold group-hover:text-brand">{j.title}</p>
          <p className="text-xs text-muted">{budgetLabel(j)} · posted {timeAgo(j.created_at)}</p>
        </div>
        <Badge tone={j.proposals_count ? 'brand' : 'slate'}>{j.proposals_count} proposal{j.proposals_count === 1 ? '' : 's'}</Badge>
        <Badge tone={j.status === 'open' ? 'green' : j.status === 'hired' ? 'sky' : 'slate'}>{j.status}</Badge>
      </Card>
    </Link>
  );
}

/* ------------------------------ Client: request detail ------------------------------ */
export function RequestDetail() {
  const { id } = useParams();
  const toast = useToast();
  const nav = useNavigate();
  const settings = usePublicSettings();
  const [accepting, setAccepting] = useState<JobProposal | null>(null);
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(async () => {
    const job = await q(supabase.from('job_posts').select(JOB_SELECT).eq('id', id!).maybeSingle()) as JobPost | null;
    const proposals = job ? await q(supabase.from('job_proposals').select(PROPOSAL_SELECT).eq('job_id', job.id).order('created_at')) as JobProposal[] : [];
    return { job, proposals };
  }, [id]);
  if (loading) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const j = data?.job;
  if (!j) return <EmptyState title="Request not found" action={<ButtonLink to="/app/requests">My requests</ButtonLink>} />;

  const accept = async () => {
    if (!accepting) return;
    setBusy(true);
    try {
      const orderId = await rpc<string>('respond_proposal', { p_proposal: accepting.id, p_action: 'accept', p_coupon: coupon.trim() || null });
      track('begin_checkout', { value: accepting.price, source: 'proposal' });
      toast.success('Proposal accepted — complete payment to start');
      nav(`/app/checkout/${orderId}`);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const decline = async (p: JobProposal) => {
    try { await rpc('respond_proposal', { p_proposal: p.id, p_action: 'decline' }); toast.success('Proposal declined'); reload(); } catch (e) { toast.error(e); }
  };
  const close = async () => {
    if (!(await askConfirm('Close this request? Freelancers will no longer be able to send proposals.'))) return;
    try { await rpc('close_job', { p_job: j.id }); toast.success('Request closed'); reload(); } catch (e) { toast.error(e); }
  };
  const est = accepting ? estimate(accepting.price, settings) : null;
  const pending = data!.proposals.filter((p) => p.status === 'pending');

  return (
    <div>
      <PageHeader title={j.title} subtitle={`${budgetLabel(j)} · ${j.delivery_days ? `${j.delivery_days} days · ` : ''}posted ${timeAgo(j.created_at)}`}
        action={<div className="flex gap-2"><ButtonLink to={`/jobs/${j.id}`} variant="outline" size="sm"><Eye className="h-4 w-4" />Public page</ButtonLink>{j.status === 'open' && <Button size="sm" variant="ghost" onClick={close}>Close request</Button>}</div>} />
      <Card className="p-5"><p className="whitespace-pre-line text-sm leading-relaxed">{j.description}</p></Card>
      <h2 className="mb-3 mt-8 font-heading text-lg font-semibold">Proposals ({data!.proposals.length})</h2>
      {data!.proposals.length === 0 ? (
        <EmptyState icon={Send} title="No proposals yet" text="Freelancers are notified of new requests. Most requests get their first proposal within a day." />
      ) : (
        <div className="space-y-4">
          {data!.proposals.map((p) => (
            <Card key={p.id} className={cn('p-5', p.status === 'accepted' && 'border-emerald-400')}>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex min-w-0 flex-1 gap-3">
                  <Avatar url={p.freelancer?.avatar_url} name={p.freelancer?.full_name} size={44} />
                  <div className="min-w-0">
                    <Link to={`/freelancers/${p.freelancer_id}`} className="flex items-center gap-1 font-semibold hover:text-brand">{p.freelancer?.full_name}{p.freelancer?.is_verified && <VerifiedBadge />}</Link>
                    <p className="truncate text-xs text-muted">{p.freelancer?.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2"><Stars value={p.freelancer?.rating_avg ?? 0} count={p.freelancer?.rating_count} />{p.freelancer && <SellerBadges p={p.freelancer} />}</div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-4 text-sm sm:text-right">
                  <div><p className="font-heading text-xl font-semibold">{money(p.price)}</p><p className="text-xs text-muted"><Clock className="inline h-3 w-3" /> {p.delivery_days} days · <RefreshCw className="inline h-3 w-3" /> {p.revisions} rev.</p></div>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-navy/85 dark:text-slate-300">{p.cover_letter}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {p.status === 'pending' && j.status === 'open' ? (
                  <><Button size="sm" onClick={() => { setAccepting(p); setCoupon(''); }}><Check className="h-4 w-4" />Hire for {money(p.price)}</Button>
                    <Button size="sm" variant="ghost" onClick={() => decline(p)}><X className="h-4 w-4" />Decline</Button></>
                ) : <Badge tone={p.status === 'accepted' ? 'green' : 'slate'}>{p.status}</Badge>}
                {p.order_id && <ButtonLink size="sm" variant="outline" to={`/app/orders/${p.order_id}`}>Open order</ButtonLink>}
                <span className="ml-auto text-xs text-muted">{timeAgo(p.created_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {pending.length > 1 && <p className="mt-4 text-xs text-muted">When you hire one freelancer, the other proposals are declined automatically.</p>}
      <Modal open={!!accepting} onClose={() => setAccepting(null)} title="Hire this freelancer">
        {accepting && est && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-navy-900">
              <p className="font-medium">{accepting.freelancer?.full_name}</p>
              <dl className="mt-2 space-y-1">
                <div className="flex justify-between"><dt className="text-muted">Price</dt><dd>{money(accepting.price)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Service fee</dt><dd>{est.fee ? money(est.fee) : 'Free'}</dd></div>
              </dl>
            </div>
            <Input id="accept-coupon" label="Coupon code (optional)" placeholder="e.g. WELCOME10" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} maxLength={30} hint="Discounts are applied on the next step." />
            <GuaranteeNote />
            <Button size="lg" className="w-full" loading={busy} onClick={accept}><Ticket className="h-4 w-4" />Accept & continue to payment</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------ Freelancer: proposals ------------------------------ */
export function MyProposals() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => q(supabase.from('job_proposals').select('*, job:job_posts!job_proposals_job_id_fkey(id,title,status)').eq('freelancer_id', user!.id).order('created_at', { ascending: false })) as Promise<JobProposal[]>, [user?.id]);
  const open = useAsync(() => q(supabase.from('job_posts').select(JOB_SELECT).eq('status', 'open').order('created_at', { ascending: false }).limit(5)) as Promise<JobPost[]>, []);
  const withdraw = async (id: string) => {
    if (!(await askConfirm('Withdraw this proposal?'))) return;
    try { await rpc('withdraw_proposal', { p_proposal: id }); toast.success('Proposal withdrawn'); reload(); } catch (e) { toast.error(e); }
  };
  const tone = { pending: 'amber', accepted: 'green', declined: 'slate', withdrawn: 'slate' } as const;
  return (
    <div>
      <PageHeader title="My proposals" subtitle="Proposals you sent to client requests." action={<ButtonLink to="/jobs"><Send className="h-4 w-4" />Find requests</ButtonLink>} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? <PageLoader /> : data?.length ? (
        <Card className="divide-y divide-slate-100 dark:divide-navy-700">
          {data.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Link to={`/jobs/${p.job_id}`} className="truncate font-medium hover:text-brand">{p.job?.title ?? 'Request'}</Link>
                <p className="text-xs text-muted">{money(p.price)} · {p.delivery_days} days · sent {timeAgo(p.created_at)}</p>
              </div>
              <Badge tone={tone[p.status]}>{p.status}</Badge>
              {p.order_id && <ButtonLink size="sm" variant="outline" to={`/app/orders/${p.order_id}`}>Open order</ButtonLink>}
              {p.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => withdraw(p.id)}>Withdraw</Button>}
            </div>
          ))}
        </Card>
      ) : <EmptyState icon={Send} title="No proposals yet" text="Browse client requests and send a proposal with your price and timeline." action={<ButtonLink to="/jobs">Browse requests</ButtonLink>} />}
      {!!open.data?.length && (
        <>
          <h2 className="mb-3 mt-8 font-heading text-lg font-semibold">Latest open requests</h2>
          <div className="space-y-3">{open.data.map((j) => <JobCard key={j.id} j={j} />)}</div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Freelancer: gig analytics ------------------------------ */
interface Row { gig_id: string; title: string; status: GigStatus; views: number; clicks: number; orders: number; revenue: number }
export function GigAnalytics() {
  const { profile } = useAuth();
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const { data, loading, error, reload } = useAsync(() => rpc<Row[]>('get_gig_analytics', { p_days: Number(days) }), [days]);
  const rows = (data ?? []).map((r) => ({ ...r, views: Number(r.views), clicks: Number(r.clicks), orders: Number(r.orders), revenue: Number(r.revenue) }));
  const sum = (k: 'views' | 'clicks' | 'orders' | 'revenue') => rows.reduce((a, r) => a + r[k], 0);
  const conv = (o: number, v: number) => (v ? `${((o / v) * 100).toFixed(1)}%` : '—');
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <div>
      <PageHeader title="Gig analytics" subtitle="Views, contact clicks and orders for each of your gigs." action={<Tabs value={days} onChange={setDays} tabs={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? <PageLoader /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Gig views" value={sum('views').toLocaleString()} icon={Eye} />
            <StatCard label="Contact clicks" value={sum('clicks').toLocaleString()} icon={MousePointerClick} hint={`${conv(sum('clicks'), sum('views'))} of views`} />
            <StatCard label="Paid orders" value={sum('orders')} icon={ShoppingCart} hint={`${conv(sum('orders'), sum('views'))} conversion`} />
            <StatCard label="Earned (completed)" value={money(sum('revenue'))} icon={TrendingUp} />
          </div>
          <Card className="mt-6 overflow-x-auto">
            {rows.length === 0 ? <div className="p-6"><EmptyState icon={BarChart3} title="No gigs yet" text="Publish a gig to start collecting views." action={<ButtonLink to="/app/gigs/new">Create a gig</ButtonLink>} /></div> : (
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-slate-100 text-left text-xs uppercase text-muted dark:border-navy-700"><th className="p-3">Gig</th><th className="p-3">Views</th><th className="p-3 text-right">Clicks</th><th className="p-3 text-right">Orders</th><th className="p-3 text-right">Conversion</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.gig_id} className="border-b border-slate-50 last:border-0 dark:border-navy-700/50">
                      <td className="max-w-[260px] p-3"><Link to={`/gigs/${r.gig_id}`} className="line-clamp-1 font-medium hover:text-brand">{r.title}</Link>{r.status !== 'published' && <Badge className="mt-1">{r.status.replace('_', ' ')}</Badge>}</td>
                      <td className="p-3"><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-700"><div className="h-full rounded-full bg-brand" style={{ width: `${(r.views / max) * 100}%` }} /></div>{r.views}</div></td>
                      <td className="p-3 text-right">{r.clicks}</td>
                      <td className="p-3 text-right">{r.orders}</td>
                      <td className="p-3 text-right font-medium">{conv(r.orders, r.views)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card className="mt-6 p-5 text-sm">
            <p className="font-heading font-semibold">Tips to get more orders</p>
            <ul className="mt-2 space-y-1 text-muted [&_li]:ml-5 [&_li]:list-disc">
              <li>Many views but few clicks? Improve your cover image and starting price.</li>
              <li>Clicks but no orders? Make packages clearer and reply to messages quickly.</li>
              <li>{profile?.is_verified ? 'You are verified — great.' : <>Get the verified badge in <Link to="/app/settings?tab=verification" className="text-brand">Settings → Verification</Link>.</>}</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
