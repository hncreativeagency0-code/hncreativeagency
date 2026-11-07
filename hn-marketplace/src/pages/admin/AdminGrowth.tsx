import { askConfirm, askPrompt } from '@/context/DialogContext';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Eye, Plus, Mail, MessageCircle, ExternalLink, Ticket, Trash2 } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAsync, q } from '@/lib/hooks';
import { openPrivateFile } from '@/lib/storage';
import { useToast } from '@/context/ToastContext';
import type { Coupon, JobPost, Lead, VerificationRequest } from '@/lib/types';
import { Avatar, Badge, Button, Card, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Select, Tabs, Textarea } from '@/components/ui';
import { date, dateTime, money, timeAgo } from '@/lib/utils';
import { Table, useAct } from './Admin';
import { JOB_SELECT, budgetLabel } from '@/pages/public/Jobs';
import { waLink } from '@/lib/site';

/* ---------------- Leads: consultations, managed projects, agency packages ---------------- */
const LEAD_KIND: Record<Lead['kind'], string> = { consultation: 'Consultation', managed_project: 'Managed project', agency_package: 'Agency package' };
const LEAD_TONE = { new: 'amber', contacted: 'sky', won: 'green', lost: 'slate' } as const;
export function AdminLeads() {
  const [kind, setKind] = useState<'all' | Lead['kind']>('all');
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(200);
    if (kind !== 'all') query = query.eq('kind', kind);
    if (status === 'open') query = query.in('status', ['new', 'contacted']);
    const [leads, contact] = await Promise.all([q(query), q(supabase.from('contact_messages').select('*').eq('handled', false).order('created_at', { ascending: false }).limit(50))]);
    return { leads: leads as Lead[], contact: contact as { id: string; name: string; email: string; service: string | null; message: string; created_at: string }[] };
  }, [kind, status]);
  const { act, busy } = useAct(reload);
  const [open, setOpen] = useState<Lead | null>(null);
  const [note, setNote] = useState('');
  const setLead = (l: Lead, st: Lead['status']) => act(l.id, async () => { const { error: e } = await supabase.from('leads').update({ status: st, admin_note: note || l.admin_note }).eq('id', l.id); if (e) throw e; setOpen(null); }, 'Lead updated');
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div>
      <PageHeader title="Leads & bookings" subtitle="Free consultations, managed-project requests, agency package enquiries and contact messages." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={kind} onChange={setKind} tabs={[{ value: 'all', label: 'All' }, { value: 'consultation', label: 'Consultations' }, { value: 'managed_project', label: 'Managed' }, { value: 'agency_package', label: 'Packages' }]} />
        <Tabs value={status} onChange={setStatus} tabs={[{ value: 'open', label: 'Open' }, { value: 'all', label: 'All statuses' }]} />
      </div>
      <Table head={['Received', 'Type', 'Name', 'Details', 'Status', '']} empty={!data!.leads.length}>
        {data!.leads.map((l) => (
          <tr key={l.id}>
            <td className="whitespace-nowrap text-muted">{timeAgo(l.created_at)}</td>
            <td><Badge tone="brand">{LEAD_KIND[l.kind]}</Badge></td>
            <td><p className="font-medium">{l.name}</p><p className="text-xs text-muted">{l.email}{l.phone && ` · ${l.phone}`}</p></td>
            <td className="max-w-[280px] text-xs">
              {l.package && <p><b>{l.package}</b></p>}
              {l.service && <p>{l.service}{l.budget && ` · ${l.budget}`}</p>}
              {l.preferred_date && <p>📅 {date(l.preferred_date)} {l.preferred_time}</p>}
              {l.message && <p className="line-clamp-2 text-muted">{l.message}</p>}
            </td>
            <td><Badge tone={LEAD_TONE[l.status]}>{l.status}</Badge></td>
            <td><Button size="sm" variant="outline" onClick={() => { setOpen(l); setNote(l.admin_note ?? ''); }}>Open</Button></td>
          </tr>
        ))}
      </Table>
      {data!.contact.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-heading text-lg font-semibold">Unhandled contact messages</h2>
          <Card className="divide-y divide-slate-100 dark:divide-navy-700">
            {data!.contact.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{m.name} · <span className="text-muted">{m.email}</span>{m.service && <Badge className="ml-2">{m.service}</Badge>}</p><p className="mt-1 text-sm text-muted">{m.message}</p><p className="mt-1 text-xs text-muted">{dateTime(m.created_at)}</p></div>
                <div className="flex gap-2">
                  <a href={`mailto:${m.email}`} className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-300 px-3 text-sm dark:border-navy-700"><Mail className="h-4 w-4" />Reply</a>
                  <Button size="sm" loading={busy === m.id} onClick={() => act(m.id, async () => { const { error: e } = await supabase.from('contact_messages').update({ handled: true }).eq('id', m.id); if (e) throw e; }, 'Marked as handled')}><Check className="h-4 w-4" />Done</Button>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${LEAD_KIND[open.kind]} · ${open.name}` : ''} wide>
        {open && (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
              {[['Email', open.email], ['Phone / WhatsApp', open.phone], ['Business', open.company], ['Service', open.service], ['Package', open.package], ['Budget', open.budget],
                ['Preferred day', open.preferred_date ? date(open.preferred_date) : null], ['Preferred time', open.preferred_time]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            {open.message && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 dark:bg-navy-900">{open.message}</p>}
            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${open.email}?subject=${encodeURIComponent('HN Creative Agency — ' + LEAD_KIND[open.kind])}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 px-3 font-medium dark:border-navy-700"><Mail className="h-4 w-4" />Email</a>
              {open.phone && <a href={waLink(open.phone.replace(/^0/, '92').replace(/[^\d]/g, ''), `Assalam o Alaikum ${open.name}, this is HN Creative Agency about your ${LEAD_KIND[open.kind].toLowerCase()} request.`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 font-medium text-white"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
            </div>
            <Textarea id="lead-note" label="Internal note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            <div className="flex flex-wrap gap-2">
              {(['contacted', 'won', 'lost'] as const).map((st) => <Button key={st} size="sm" variant={st === 'won' ? 'primary' : 'outline'} loading={busy === open.id} onClick={() => setLead(open, st)} className="capitalize">Mark {st}</Button>)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- Freelancer verification ---------------- */
export function AdminVerification() {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const { data, loading, error, reload } = useAsync(() => q(supabase.from('verification_requests').select('*, user:profiles!verification_requests_user_id_fkey(id,full_name,avatar_url,title)').eq('status', tab).order('created_at', { ascending: tab === 'pending' })) as Promise<VerificationRequest[]>, [tab]);
  const { act, busy } = useAct(reload);
  const toast = useToast();
  const view = (path: string) => openPrivateFile('verification-docs', path).catch((e) => toast.error(e));
  return (
    <div>
      <PageHeader title="Freelancer verification" subtitle="Check the CNIC matches the legal name and the work samples are genuine before approving." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pending', label: 'To review' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
      <div className="mt-4 space-y-4">
        {error && <ErrorBox message={error} onRetry={reload} />}
        {loading ? <PageLoader /> : !data?.length ? <EmptyState title="Nothing to review" /> : data.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex flex-1 gap-3">
                <Avatar url={r.user?.avatar_url} name={r.user?.full_name} size={44} />
                <div className="min-w-0 text-sm">
                  <Link to={`/freelancers/${r.user_id}`} className="font-semibold hover:text-brand">{r.user?.full_name}</Link>
                  <p className="text-xs text-muted">{r.user?.title} · submitted {timeAgo(r.created_at)}</p>
                  <p className="mt-2">Legal name: <b>{r.legal_name}</b></p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => view(r.id_front_path)}><Eye className="h-4 w-4" />CNIC front</Button>
                    {r.id_back_path && <Button size="sm" variant="outline" onClick={() => view(r.id_back_path!)}><Eye className="h-4 w-4" />CNIC back</Button>}
                  </div>
                  <ul className="mt-3 space-y-1">{r.sample_links.map((l) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-brand">{l}<ExternalLink className="h-3 w-3" /></a></li>)}</ul>
                  {r.notes && <p className="mt-2 text-muted">“{r.notes}”</p>}
                  {r.admin_note && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs dark:bg-navy-900">Note: {r.admin_note}</p>}
                </div>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" loading={busy === r.id} onClick={() => act(r.id, () => rpc('admin_review_verification', { p_request: r.id, p_approve: true, p_note: null }), 'Freelancer verified')}><Check className="h-4 w-4" />Approve</Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    const note = await askPrompt('What should the freelancer fix?', { placeholder: 'e.g. CNIC photo is blurry — please upload a clearer photo', confirmLabel: 'Send back' });
                    if (note) act(r.id, () => rpc('admin_review_verification', { p_request: r.id, p_approve: false, p_note: note }), 'Sent back to freelancer');
                  }}><X className="h-4 w-4" />Reject</Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted">CNIC images are stored in a private bucket and shown with links that expire after 10 minutes. Delete old documents you no longer need.</p>
    </div>
  );
}

/* ---------------- Coupons ---------------- */
export function AdminCoupons() {
  const [src, setSrc] = useState<'admin' | 'credits'>('admin');
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('coupons').select('*').order('created_at', { ascending: false }).limit(200);
    query = src === 'admin' ? query.eq('source', 'admin') : query.neq('source', 'admin');
    return q(query) as Promise<Coupon[]>;
  }, [src]);
  const { act, busy } = useAct(reload);
  const toast = useToast();
  const blank = { code: '', description: '', kind: 'percent' as Coupon['kind'], value: '10', max_discount: '', min_order: '0', first_order_only: false, max_uses: '', expires_at: '' };
  const [f, setF] = useState<typeof blank | null>(null);
  const save = async () => {
    if (!f) return;
    const code = f.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return toast.error('Code: 3–30 letters, numbers, - or _');
    if (!(Number(f.value) > 0) || (f.kind === 'percent' && Number(f.value) > 90)) return toast.error(f.kind === 'percent' ? 'Percent must be 1–90' : 'Enter an amount');
    await act('new', async () => {
      const { error: e } = await supabase.from('coupons').insert({
        code, description: f.description.trim() || null, kind: f.kind, value: Number(f.value), max_discount: f.max_discount ? Number(f.max_discount) : null,
        min_order: Number(f.min_order) || 0, first_order_only: f.first_order_only, max_uses: f.max_uses ? Number(f.max_uses) : null,
        expires_at: f.expires_at ? new Date(`${f.expires_at}T23:59:59`).toISOString() : null, source: 'admin',
      });
      if (e) throw e; setF(null);
    }, 'Coupon created');
  };
  const toggle = (c: Coupon) => act(c.id, async () => { const { error: e } = await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id); if (e) throw e; }, c.is_active ? 'Coupon paused' : 'Coupon activated');
  const remove = async (c: Coupon) => {
    if (c.used_count > 0) return toast.info('This coupon has been used — pause it instead so order history stays intact.');
    if (await askConfirm(`Delete coupon ${c.code}?`, { danger: true, confirmLabel: 'Delete' })) act(c.id, async () => { const { error: e } = await supabase.from('coupons').delete().eq('id', c.id); if (e) throw e; }, 'Coupon deleted');
  };
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div>
      <PageHeader title="Coupons" subtitle="Discounts come out of HN’s fee — freelancers always get their full earning." action={<Button onClick={() => setF(blank)}><Plus className="h-4 w-4" />New coupon</Button>} />
      <Tabs value={src} onChange={setSrc} tabs={[{ value: 'admin', label: 'Promo codes' }, { value: 'credits', label: 'Automatic credits (late delivery, referrals)' }]} />
      <div className="mt-4">
        <Table head={['Code', 'Discount', 'Rules', 'Used', 'Status', '']} empty={!data!.length}>
          {data!.map((c) => (
            <tr key={c.id}>
              <td><p className="font-mono font-semibold">{c.code}</p>{c.description && <p className="text-xs text-muted">{c.description}</p>}</td>
              <td>{c.kind === 'percent' ? `${Number(c.value)}%` : money(c.value)}{c.max_discount ? <span className="text-xs text-muted"> (max {money(c.max_discount)})</span> : null}</td>
              <td className="text-xs text-muted">{[c.min_order > 0 && `min ${money(c.min_order)}`, c.first_order_only && 'first order', c.owner_id && 'personal', c.expires_at && `until ${date(c.expires_at)}`].filter(Boolean).join(' · ') || '—'}</td>
              <td>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
              <td><Badge tone={c.is_active ? 'green' : 'slate'}>{c.is_active ? 'Active' : 'Paused'}</Badge></td>
              <td className="whitespace-nowrap"><Button size="sm" variant="ghost" loading={busy === c.id} onClick={() => toggle(c)}>{c.is_active ? 'Pause' : 'Activate'}</Button>
                {c.source === 'admin' && <button onClick={() => remove(c)} aria-label="Delete coupon" className="ml-1 align-middle"><Trash2 className="h-4 w-4 text-muted hover:text-red-500" /></button>}</td>
            </tr>
          ))}
        </Table>
      </div>
      <Modal open={!!f} onClose={() => setF(null)} title="New coupon">
        {f && (
          <div className="space-y-4">
            <Input id="cp-code" label="Code" placeholder="EID20" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} maxLength={30} />
            <Input id="cp-desc" label="Description (shown to staff)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={200} />
            <div className="grid grid-cols-2 gap-3">
              <Select id="cp-kind" label="Type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Coupon['kind'] })}><option value="percent">Percent off</option><option value="amount">Fixed PKR off</option></Select>
              <Input id="cp-value" label={f.kind === 'percent' ? 'Percent' : 'Amount (PKR)'} type="number" min={1} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
              <Input id="cp-max" label="Max discount (PKR)" type="number" min={0} value={f.max_discount} onChange={(e) => setF({ ...f, max_discount: e.target.value })} hint="Optional cap" />
              <Input id="cp-min" label="Minimum order (PKR)" type="number" min={0} value={f.min_order} onChange={(e) => setF({ ...f, min_order: e.target.value })} />
              <Input id="cp-uses" label="Total uses allowed" type="number" min={1} value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })} hint="Empty = unlimited" />
              <Input id="cp-exp" label="Expires on" type="date" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={f.first_order_only} onChange={(e) => setF({ ...f, first_order_only: e.target.checked })} />First order only</label>
            <p className="text-xs text-muted">Each client can use a code once.</p>
            <Button className="w-full" loading={busy === 'new'} onClick={save}><Ticket className="h-4 w-4" />Create coupon</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- Client requests (job posts) ---------------- */
export function AdminJobs() {
  const [status, setStatus] = useState<'open' | 'hired' | 'closed'>('open');
  const { data, loading, error, reload } = useAsync(() => q(supabase.from('job_posts').select(JOB_SELECT).eq('status', status).order('created_at', { ascending: false }).limit(200)) as Promise<JobPost[]>, [status]);
  const { act, busy } = useAct(reload);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div>
      <PageHeader title="Client requests" subtitle="Remove spam or off-platform requests. Clients and freelancers see these on the Requests board." />
      <Tabs value={status} onChange={setStatus} tabs={[{ value: 'open', label: 'Open' }, { value: 'hired', label: 'Hired' }, { value: 'closed', label: 'Closed' }]} />
      <div className="mt-4">
        <Table head={['Posted', 'Request', 'Client', 'Budget', 'Proposals', '']} empty={!data!.length}>
          {data!.map((j) => (
            <tr key={j.id}>
              <td className="whitespace-nowrap text-muted">{timeAgo(j.created_at)}</td>
              <td className="max-w-[300px]"><Link to={`/jobs/${j.id}`} className="font-medium hover:text-brand">{j.title}</Link><p className="line-clamp-1 text-xs text-muted">{j.description}</p></td>
              <td>{j.client?.full_name}</td>
              <td className="whitespace-nowrap">{budgetLabel(j)}</td>
              <td>{j.proposals_count}</td>
              <td>{j.status === 'open' && <Button size="sm" variant="outline" loading={busy === j.id} onClick={() => askConfirm('Close this request?').then((ok) => ok && act(j.id, () => rpc('close_job', { p_job: j.id }), 'Request closed'))}>Close</Button>}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
