import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FileText, Clock, Wallet, Users, Send, CheckCircle2, Search, Lightbulb } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAsync, useCategories, q } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { JobPost, JobProposal } from '@/lib/types';
import { Avatar, Badge, Button, ButtonLink, Card, EmptyState, ErrorBox, Input, PageLoader, Select, Textarea } from '@/components/ui';
import { SectionTitle } from '@/components/marketing';
import { useSeo } from '@/lib/seo';
import { track } from '@/lib/analytics';
import { cn, money, timeAgo } from '@/lib/utils';

export const JOB_SELECT = '*, client:profiles!job_posts_client_id_fkey(id,full_name,avatar_url,city), category:categories!job_posts_category_id_fkey(name,slug)';

export const budgetLabel = (j: Pick<JobPost, 'budget_min' | 'budget_max'>) =>
  j.budget_min && j.budget_max ? `${money(j.budget_min)} – ${money(j.budget_max)}` : j.budget_min ? `From ${money(j.budget_min)}` : j.budget_max ? `Up to ${money(j.budget_max)}` : 'Open budget';

export function JobCard({ j }: { j: JobPost }) {
  return (
    <Link to={`/jobs/${j.id}`} className="group block">
      <Card className="p-5 transition group-hover:border-brand group-hover:shadow-lift">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {j.category && <Badge tone="brand">{j.category.name}</Badge>}<span>Posted {timeAgo(j.created_at)}</span>
          {j.status !== 'open' && <Badge tone={j.status === 'hired' ? 'green' : 'slate'}>{j.status === 'hired' ? 'Hired' : 'Closed'}</Badge>}
        </div>
        <h3 className="mt-2 font-heading text-lg font-semibold leading-snug text-navy group-hover:text-brand dark:text-white">{j.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{j.description}</p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5"><Wallet className="h-4 w-4 text-brand" />{budgetLabel(j)}</span>
          {j.delivery_days && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-brand" />{j.delivery_days} days</span>}
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-brand" />{j.proposals_count} proposal{j.proposals_count === 1 ? '' : 's'}</span>
        </div>
      </Card>
    </Link>
  );
}

/* ------------------------------ Public job board ------------------------------ */
export function JobsBoard() {
  const [params, setParams] = useSearchParams();
  const { parents } = useCategories();
  const { profile } = useAuth();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const cat = params.get('category');
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('job_posts').select(JOB_SELECT).eq('status', 'open').order('created_at', { ascending: false }).limit(50);
    const qq = params.get('q');
    if (qq) query = query.ilike('title', `%${qq}%`);
    if (cat) { const c = parents.find((x) => x.slug === cat); if (c) query = query.eq('category_id', c.id); }
    return q(query) as Promise<JobPost[]>;
  }, [params.toString(), parents.length]);
  useSeo({ title: 'Freelance Requests from Pakistani Clients', description: 'Browse open requests from clients in Pakistan for logos, websites, videos, social media and ads. Send a proposal in minutes.', path: '/jobs' });
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-navy dark:text-white">Client requests</h1>
          <p className="mt-1 text-muted">Clients describe what they need — freelancers send proposals with a price and timeline.</p>
        </div>
        {profile?.role !== 'freelancer' && <ButtonLink to="/post-request"><FileText className="h-4 w-4" />Post a request</ButtonLink>}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <form onSubmit={(e) => { e.preventDefault(); const n = new URLSearchParams(params); if (term) n.set('q', term); else n.delete('q'); setParams(n); }} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search requests" aria-label="Search requests"
            className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand dark:border-navy-700 dark:bg-navy-900" />
        </form>
        <select value={cat ?? ''} onChange={(e) => { const n = new URLSearchParams(params); if (e.target.value) n.set('category', e.target.value); else n.delete('category'); setParams(n); }} aria-label="Category"
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900">
          <option value="">All categories</option>{parents.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div className="mt-6 space-y-4">
        {error && <ErrorBox message={error} onRetry={reload} />}
        {loading ? <PageLoader /> : data?.length ? data.map((j) => <JobCard key={j.id} j={j} />) : (
          <EmptyState icon={FileText} title="No open requests right now" text="New requests appear here as soon as clients post them."
            action={profile?.role === 'freelancer' ? <ButtonLink to="/app/gigs/new">Create a gig instead</ButtonLink> : <ButtonLink to="/post-request">Post the first request</ButtonLink>} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Job detail ------------------------------- */
export function JobDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ cover: '', price: '', days: '', revisions: '1' });
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(async () => {
    const job = await q(supabase.from('job_posts').select(JOB_SELECT).eq('id', id!).maybeSingle()) as JobPost | null;
    const mine = user && job ? await q(supabase.from('job_proposals').select('*').eq('job_id', job.id).eq('freelancer_id', user.id).maybeSingle()) as JobProposal | null : null;
    return { job, mine };
  }, [id, user?.id]);
  useSeo(data?.job ? { title: data.job.title, description: data.job.description.slice(0, 155), path: `/jobs/${data.job.id}` } : { title: 'Request', noindex: !data?.job });
  if (loading) return <PageLoader />;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorBox message={error} onRetry={reload} /></div>;
  const j = data?.job;
  if (!j) return <div className="mx-auto max-w-3xl p-6"><EmptyState title="Request not found" text="It may have been closed or removed." action={<ButtonLink to="/jobs">See open requests</ButtonLink>} /></div>;
  const isOwner = user?.id === j.client_id;

  const submit = async () => {
    if (f.cover.trim().length < 30) return toast.error('Write at least 30 characters about how you will do the work');
    if (!(Number(f.price) >= 500)) return toast.error('Minimum price is PKR 500');
    if (!(Number(f.days) >= 1 && Number(f.days) <= 180)) return toast.error('Delivery must be 1–180 days');
    setBusy(true);
    try {
      await rpc('submit_proposal', { p_job: j.id, p_cover_letter: f.cover.trim(), p_price: Number(f.price), p_delivery_days: Number(f.days), p_revisions: Number(f.revisions) });
      toast.success('Proposal sent — the client has been notified'); reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <nav className="mb-3 text-sm text-muted"><Link to="/jobs" className="hover:text-brand">Requests</Link>{j.category && <> / {j.category.name}</>}</nav>
        <h1 className="font-heading text-3xl font-semibold leading-snug text-navy dark:text-white">{j.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {j.client && <span className="flex items-center gap-2"><Avatar url={j.client.avatar_url} name={j.client.full_name} size={26} />{j.client.full_name}{j.client.city && ` · ${j.client.city}`}</span>}
          <span>Posted {timeAgo(j.created_at)}</span>
          <Badge tone={j.status === 'open' ? 'green' : 'slate'}>{j.status === 'open' ? 'Open' : j.status === 'hired' ? 'Hired' : 'Closed'}</Badge>
        </div>
        <Card className="mt-6 p-6"><p className="whitespace-pre-line leading-relaxed text-navy/85 dark:text-slate-300">{j.description}</p></Card>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Card className="p-4"><p className="text-xs text-muted">Budget</p><p className="font-semibold">{budgetLabel(j)}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted">Wanted in</p><p className="font-semibold">{j.delivery_days ? `${j.delivery_days} days` : 'Flexible'}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted">Proposals</p><p className="font-semibold">{j.proposals_count}</p></Card>
        </div>
      </div>
      <aside>
        <Card className="sticky top-24 p-5">
          {isOwner ? (
            <><p className="font-heading font-semibold">This is your request</p><p className="mt-1 text-sm text-muted">Compare proposals and hire from your dashboard.</p><ButtonLink to={`/app/requests/${j.id}`} className="mt-4 w-full">View proposals ({j.proposals_count})</ButtonLink></>
          ) : data?.mine ? (
            <div className="text-sm">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="mt-2 font-heading font-semibold">You sent a proposal</p>
              <p className="mt-1 text-muted">{money(data.mine.price)} · {data.mine.delivery_days} days · <span className="capitalize">{data.mine.status}</span></p>
              {data.mine.order_id && <ButtonLink to={`/app/orders/${data.mine.order_id}`} className="mt-4 w-full">Open order</ButtonLink>}
              <ButtonLink to="/app/proposals" variant="outline" className="mt-2 w-full">My proposals</ButtonLink>
            </div>
          ) : j.status !== 'open' ? (
            <p className="text-sm text-muted">This request is no longer accepting proposals.</p>
          ) : !user ? (
            <><p className="font-heading font-semibold">Interested in this job?</p><p className="mt-1 text-sm text-muted">Sign in as a freelancer to send a proposal.</p>
              <Button className="mt-4 w-full" onClick={() => nav(`/login?next=/jobs/${j.id}`)}>Sign in to apply</Button>
              <ButtonLink to="/register?role=freelancer" variant="outline" className="mt-2 w-full">Join as a freelancer</ButtonLink></>
          ) : profile?.role !== 'freelancer' ? (
            <p className="text-sm text-muted">Only freelancer accounts can send proposals.</p>
          ) : (
            <div className="space-y-3">
              <p className="font-heading font-semibold">Send a proposal</p>
              <Textarea id="pr-cover" label="How will you do it?" rows={5} value={f.cover} onChange={(e) => setF({ ...f, cover: e.target.value })} maxLength={3000}
                hint="Mention similar work, what’s included and your process." />
              <div className="grid grid-cols-2 gap-2">
                <Input id="pr-price" label="Your price (PKR)" type="number" min={500} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
                <Input id="pr-days" label="Days" type="number" min={1} max={180} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
              </div>
              <Select id="pr-rev" label="Revisions included" value={f.revisions} onChange={(e) => setF({ ...f, revisions: e.target.value })}>
                {[0, 1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
              <Button className="w-full" loading={busy} onClick={submit}><Send className="h-4 w-4" />Send proposal</Button>
              <p className="text-xs text-muted">If the client accepts, an order is created and you start after payment is confirmed.</p>
            </div>
          )}
        </Card>
      </aside>
    </div>
  );
}

/* ------------------------------- Post a request ------------------------------- */
export function PostRequest() {
  const { user, profile } = useAuth();
  const { parents } = useCategories();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ title: '', description: '', category: '', min: '', max: '', days: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useSeo({ title: 'Post a Request – Get Proposals from Freelancers', description: 'Describe what you need and get proposals with prices in PKR from verified Pakistani freelancers. Free to post.', path: '/post-request' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return nav('/login?next=/post-request');
    const er: Record<string, string> = {};
    if (f.title.trim().length < 10) er.title = 'Give your request a clear title (at least 10 characters)';
    if (f.description.trim().length < 30) er.description = 'Describe what you need (at least 30 characters)';
    if (f.min && Number(f.min) < 500) er.min = 'Minimum PKR 500';
    if (f.min && f.max && Number(f.max) < Number(f.min)) er.max = 'Must be more than the minimum';
    if (f.days && !(Number(f.days) >= 1 && Number(f.days) <= 180)) er.days = '1–180 days';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const id = await rpc<string>('post_job', { p_title: f.title.trim(), p_description: f.description.trim(), p_category: f.category || null,
        p_budget_min: f.min ? Number(f.min) : null, p_budget_max: f.max ? Number(f.max) : null, p_delivery_days: f.days ? Number(f.days) : null });
      track('post_request');
      toast.success('Request posted — freelancers can now send proposals');
      nav(`/app/requests/${id}`);
    } catch (err) { toast.error(err); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_340px]">
      <div>
        <SectionTitle className="!mx-0 !text-left" eyebrow="Post a request" title="Tell freelancers what you need" sub="It’s free. You’ll get proposals with prices and timelines — hire the one you like." />
        {profile && profile.role !== 'client' ? (
          <Card className="mt-8 p-6 text-sm text-muted">Requests are posted from client accounts. {profile.role === 'freelancer' && <>Looking for work? <Link to="/jobs" className="font-medium text-brand">Browse open requests</Link>.</>}</Card>
        ) : (
          <Card className="mt-8 p-6 sm:p-8">
            <form onSubmit={submit} className="space-y-5" noValidate>
              <Input id="job-title" label="Title" placeholder="e.g. Logo for my home bakery in Lahore" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} error={errors.title} required />
              <Select id="job-cat" label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                <option value="">Choose a category</option>{parents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Textarea id="job-desc" label="Describe your project" rows={7} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={5000} error={errors.description} required
                hint={`${f.description.length}/5000 · What do you need, for whom, examples you like, and anything that must be included.`} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Input id="job-min" label="Budget from (PKR)" type="number" min={500} value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} error={errors.min} />
                <Input id="job-max" label="Budget up to (PKR)" type="number" min={500} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} error={errors.max} />
                <Input id="job-days" label="Needed in (days)" type="number" min={1} max={180} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} error={errors.days} />
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto" loading={busy}>{user ? 'Post request' : 'Sign in to post'}</Button>
            </form>
          </Card>
        )}
      </div>
      <aside className="space-y-4">
        <Card className="p-5">
          <p className="flex items-center gap-2 font-heading font-semibold"><Lightbulb className="h-4 w-4 text-amber-500" />Tips for better proposals</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {['Mention your business and who your customers are', 'Share 2–3 examples you like', 'Give a realistic budget — it attracts better freelancers', 'Say which files or formats you need at the end'].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{t}</li>)}
          </ul>
        </Card>
        <Card className={cn('p-5 text-sm')}>
          <p className="font-heading font-semibold">Prefer a team to handle it?</p>
          <p className="mt-1 text-muted">Our agency can manage the whole project with one project manager.</p>
          <ButtonLink to="/managed-projects" variant="outline" size="sm" className="mt-3">Managed projects</ButtonLink>
        </Card>
      </aside>
    </div>
  );
}
