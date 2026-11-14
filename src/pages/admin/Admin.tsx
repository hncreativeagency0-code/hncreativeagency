import { askConfirm, askPrompt } from '@/context/DialogContext';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Briefcase, CreditCard, ArrowDownToLine, Gavel, ShoppingBag, TrendingUp, Banknote, AlertCircle, Eye, Check, X, Plus, Trash2, Mail } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAsync, useSettings, clearCategoryCache, q, type PlatformSettings, type PaymentChannel } from '@/lib/hooks';
import { CHANNEL_META } from '../app/Checkout';
import { openPrivateFile } from '@/lib/storage';
import { useToast } from '@/context/ToastContext';
import type { Category, Gig, Order, PaymentStatus, Role, WithdrawalStatus } from '@/lib/types';
import { Avatar, Badge, Button, Card, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Pagination, Select, StatCard, Tabs, Textarea } from '@/components/ui';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/cards';
import { dateTime, money, slugify, timeAgo, WITHDRAWAL_STATUS, ORDER_STATUS } from '@/lib/utils';
import { OrderRow, ORDER_LIST_SELECT } from '../app/Dashboard';
import { mask } from '../app/Wallet';
import { gigChecklist, qualityScore } from '@/lib/gigQuality';

export const Table = ({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) => (
  <Card className="overflow-x-auto">
    {empty ? <div className="p-6"><EmptyState title="Nothing here" /></div> : (
      <table className="w-full min-w-[720px] text-sm">
        <thead><tr className="border-b border-slate-100 text-left text-xs uppercase text-muted dark:border-navy-700">{head.map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
        <tbody className="[&_td]:p-3 [&_tr]:border-b [&_tr]:border-slate-50 last:[&_tr]:border-0 dark:[&_tr]:border-navy-700/50">{children}</tbody>
      </table>
    )}
  </Card>
);

export function useAct(reload: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try { await fn(); toast.success(msg); reload(); return true; } catch (e) { toast.error(e); return false; } finally { setBusy(null); }
  };
  return { act, busy };
}

/* ---------------- Overview ---------------- */
export function AdminOverview() {
  const { data: s, loading, error, reload } = useAsync(() => rpc<Record<string, number & Record<string, number>>>('admin_stats'), []);
  const recent = useAsync(() => q(supabase.from('orders').select(ORDER_LIST_SELECT).order('created_at', { ascending: false }).limit(8)) as Promise<Order[]>, []);
  const growth = useAsync(async () => {
    const [l, v] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    return { leads: l.count ?? 0, verifications: v.count ?? 0 };
  }, []);
  if (loading) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const todo = [
    { n: s!.payments_pending, l: 'payments to verify', to: '/admin/payments' }, { n: s!.gigs_pending, l: 'gigs to review', to: '/admin/gigs' },
    { n: s!.withdrawals_open, l: 'withdrawals to process', to: '/admin/withdrawals' }, { n: s!.disputes_open, l: 'open disputes', to: '/admin/disputes' },
    { n: s!.refunds_pending, l: 'refunds pending', to: '/admin/payments' }, { n: s!.reports_open, l: 'open reports', to: '/admin/reports' },
    { n: growth.data?.leads ?? 0, l: 'new leads & bookings', to: '/admin/leads' }, { n: growth.data?.verifications ?? 0, l: 'verification requests', to: '/admin/verification' },
  ].filter((t) => t.n > 0);
  const byStatus = s!.orders_by_status as unknown as Record<string, number>;
  return (
    <div>
      <PageHeader title="Admin overview" subtitle="Live figures from the database." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Clients" value={s!.clients} icon={Users} hint={`${s!.signups_30d} sign-ups in 30 days`} />
        <StatCard label="Freelancers" value={s!.freelancers} icon={Users} hint={`${s!.suspended} suspended accounts`} />
        <StatCard label="Verified payments" value={money(s!.gross_paid)} icon={Banknote} hint={`${s!.orders_total} orders total`} />
        <StatCard label="Platform revenue" value={money(s!.commission_earned)} icon={TrendingUp} hint="Commission + fees on completed orders" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-navy-700"><h2 className="font-heading font-semibold">Latest orders</h2><Link to="/admin/orders" className="text-sm font-medium text-brand">All orders</Link></div>
          {recent.data?.length ? recent.data.map((o) => <OrderRow key={o.id} o={o} viewer="admin" />) : <p className="p-6 text-sm text-muted">No orders yet.</p>}
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-heading font-semibold"><AlertCircle className="h-4 w-4 text-brand" />Needs attention</h2>
            {todo.length === 0 ? <p className="mt-3 text-sm text-muted">All clear.</p> : (
              <ul className="mt-3 space-y-2">{todo.map((t) => <li key={t.l}><Link to={t.to} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm hover:bg-brand-50 dark:bg-navy-900"><span>{t.l}</span><Badge tone="amber">{t.n}</Badge></Link></li>)}</ul>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="font-heading font-semibold">Orders by status</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {Object.entries(byStatus).map(([k, v]) => <li key={k} className="flex justify-between"><span className="text-muted">{ORDER_STATUS[k as keyof typeof ORDER_STATUS]?.label ?? k}</span><b>{v}</b></li>)}
              {!Object.keys(byStatus).length && <li className="text-muted">No orders yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Users ---------------- */
interface AdminUser { id: string; email: string; full_name: string; role: Role; status: 'active' | 'suspended'; is_verified: boolean; created_at: string; last_seen_at: string | null; completed_orders: number; email_confirmed: boolean }
export function AdminUsers() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(0);
  const [applied, setApplied] = useState({ search: '', role: '' });
  const { data, loading, error, reload } = useAsync(() => rpc<AdminUser[]>('admin_list_users', { p_search: applied.search || null, p_role: applied.role || null, p_limit: 51, p_offset: page * 50 }), [applied, page]);
  const { act, busy } = useAct(reload);
  return (
    <div>
      <PageHeader title="Users" />
      <form onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied({ search, role }); }} className="mb-4 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900"><option value="">All roles</option><option value="client">Clients</option><option value="freelancer">Freelancers</option><option value="admin">Admins</option></select>
        <Button type="submit">Search</Button>
      </form>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? <PageLoader /> : (
        <Table head={['User', 'Role', 'Status', 'Joined', 'Orders', 'Actions']} empty={!data?.length}>
          {data?.slice(0, 50).map((u) => (
            <tr key={u.id}>
              <td><div className="flex items-center gap-2"><Avatar name={u.full_name} size={30} /><div><p className="font-medium">{u.full_name || '—'} {u.is_verified && <Badge tone="brand">verified</Badge>}</p><p className="text-xs text-muted">{u.email}{!u.email_confirmed && ' · unconfirmed'}</p></div></div></td>
              <td>
                <select value={u.role} onChange={(e) => { const v = e.target.value; askConfirm(`Change ${u.full_name || 'this user'}'s role to ${v}?`).then((ok) => { if (ok) act(u.id, () => rpc('admin_set_role', { p_user: u.id, p_role: v }), 'Role updated'); }); }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-navy-700 dark:bg-navy-900"><option value="client">client</option><option value="freelancer">freelancer</option><option value="admin">admin</option></select>
              </td>
              <td><Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge></td>
              <td className="text-muted">{dateTime(u.created_at)}<br /><span className="text-xs">{u.last_seen_at ? `seen ${timeAgo(u.last_seen_at)}` : ''}</span></td>
              <td>{u.completed_orders}</td>
              <td className="space-x-1 whitespace-nowrap">
                {u.role === 'freelancer' && <Button size="sm" variant="outline" loading={busy === u.id + 'v'} onClick={() => act(u.id + 'v', () => rpc('admin_set_verified', { p_user: u.id, p_verified: !u.is_verified }), u.is_verified ? 'Verification removed' : 'Freelancer verified')}>{u.is_verified ? 'Unverify' : 'Verify'}</Button>}
                {u.status === 'active'
                  ? <Button size="sm" variant="danger" loading={busy === u.id + 's'} onClick={() => askPrompt('Reason for suspension?', { confirmLabel: 'Suspend' }).then((r) => { if (r) act(u.id + 's', () => rpc('admin_set_user_status', { p_user: u.id, p_status: 'suspended', p_reason: r }), 'User suspended'); })}>Suspend</Button>
                  : <Button size="sm" loading={busy === u.id + 's'} onClick={() => act(u.id + 's', () => rpc('admin_set_user_status', { p_user: u.id, p_status: 'active', p_reason: 'Reactivated' }), 'User reactivated')}>Reactivate</Button>}
                {u.role === 'freelancer' && <Link to={`/freelancers/${u.id}`} className="inline-flex h-8 items-center px-2 text-xs text-brand">Profile</Link>}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination page={page} hasMore={(data?.length ?? 0) > 50} onPage={setPage} />
    </div>
  );
}

/* ---------------- Gigs ---------------- */
export function AdminGigs() {
  const [tab, setTab] = useState<'pending_review' | 'published' | 'rejected' | 'all'>('pending_review');
  const { data, loading, reload } = useAsync(async () => {
    let query = supabase.from('gigs').select('*, gig_packages(price,delivery_days,features), freelancer:profiles!gigs_freelancer_id_fkey(id,full_name,avatar_url,is_verified), category:categories!gigs_category_id_fkey(name,slug)').order('updated_at', { ascending: false }).limit(100);
    if (tab !== 'all') query = query.eq('status', tab);
    return q(query) as Promise<Gig[]>;
  }, [tab]);
  const { act, busy } = useAct(reload);
  return (
    <div>
      <PageHeader title="Gig moderation" subtitle="Approve new and edited gigs before they go live." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pending_review', label: 'Awaiting review' }, { value: 'published', label: 'Live' }, { value: 'rejected', label: 'Rejected' }, { value: 'all', label: 'All' }]} />
      <div className="mt-4 space-y-3">
        {loading ? <PageLoader /> : !data?.length ? <EmptyState icon={ShoppingBag} title="No gigs here" /> : data.map((g) => {
          const checks = gigChecklist(g, g.gig_packages ?? []);
          const missing = checks.filter((c) => !c.ok);
          const score = qualityScore(checks);
          return (
          <Card key={g.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
            <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-navy-700">{g.cover_url && <img src={g.cover_url} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{g.title}</p>
              <p className="text-xs text-muted">{g.freelancer?.full_name} · {g.category?.name ?? 'No category'} · from {money(g.starting_price)} · updated {timeAgo((g as unknown as { updated_at: string }).updated_at)}</p>
              {g.rejection_reason && <p className="text-xs text-red-500">{g.rejection_reason}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={score >= 80 ? 'green' : score >= 55 ? 'amber' : 'red'}>Quality {score}%</Badge>
                {missing.slice(0, 4).map((c) => <span key={c.id} className={`text-[11px] ${c.required ? 'text-red-500' : 'text-muted'}`}>✗ {c.label}</span>)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/gigs/${g.id}`} className="inline-flex h-8 items-center gap-1 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-navy-700"><Eye className="h-4 w-4" />View</Link>
              {g.status !== 'published' && <Button size="sm" loading={busy === g.id + 'a'} onClick={() => act(g.id + 'a', () => rpc('admin_moderate_gig', { p_gig: g.id, p_approve: true }), 'Gig approved')}><Check className="h-4 w-4" />Approve</Button>}
              {g.status !== 'rejected' && <Button size="sm" variant="danger" loading={busy === g.id + 'r'} onClick={() => askPrompt('What needs to change? (sent to the freelancer)').then((r) => { if (r) act(g.id + 'r', () => rpc('admin_moderate_gig', { p_gig: g.id, p_approve: false, p_reason: r }), 'Gig sent back'); })}><X className="h-4 w-4" />{g.status === 'published' ? 'Take down' : 'Reject'}</Button>}
            </div>
          </Card>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">Checklist before approving: real cover image (not stolen or a famous brand), clear “I will…” title, honest description, PKR packages ≥ 500 with clear features, no contact details or off-platform payment requests.</p>
    </div>
  );
}

/* ---------------- Categories ---------------- */
export function AdminCategories() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => q(supabase.from('categories').select('*').order('sort_order')) as Promise<Category[]>, []);
  const [f, setF] = useState({ name: '', parent_id: '', icon: '' });
  const save = async () => {
    if (f.name.trim().length < 2) return toast.error('Enter a name');
    const { error } = await supabase.from('categories').insert({ name: f.name.trim(), slug: slugify(f.name), parent_id: f.parent_id || null, icon: f.icon || null, sort_order: (data?.length ?? 0) + 1 });
    if (error) return toast.error(error);
    clearCategoryCache(); toast.success('Category added'); setF({ name: '', parent_id: '', icon: '' }); reload();
  };
  const update = async (c: Category, patch: Partial<Category>) => {
    const { error } = await supabase.from('categories').update(patch).eq('id', c.id);
    if (error) toast.error(error); else { clearCategoryCache(); reload(); }
  };
  const remove = async (c: Category) => {
    if (!(await askConfirm(`Delete “${c.name}”? Gigs in it will lose their category. Consider deactivating instead.`, { danger: true, confirmLabel: 'Delete' }))) return;
    const { error } = await supabase.from('categories').delete().eq('id', c.id);
    if (error) toast.error(error); else { clearCategoryCache(); toast.success('Deleted'); reload(); }
  };
  if (loading) return <PageLoader />;
  const parents = (data ?? []).filter((c) => !c.parent_id);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Categories" />
      <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1"><Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <Select label="Parent" value={f.parent_id} onChange={(e) => setF({ ...f, parent_id: e.target.value })}><option value="">— Top level —</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Button onClick={save}><Plus className="h-4 w-4" />Add</Button>
      </Card>
      <div className="space-y-3">
        {parents.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-center gap-3">
              <input defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && update(p, { name: e.target.value })} className="flex-1 bg-transparent font-medium outline-none" aria-label="Category name" />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-brand" checked={p.is_active} onChange={(e) => update(p, { is_active: e.target.checked })} />Active</label>
              <button onClick={() => remove(p)} aria-label="Delete"><Trash2 className="h-4 w-4 text-muted hover:text-red-500" /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(data ?? []).filter((c) => c.parent_id === p.id).map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-navy-900">
                  {c.name}<button onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Orders ---------------- */
export function AdminOrders() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { data, loading } = useAsync(async () => {
    let query = supabase.from('orders').select(ORDER_LIST_SELECT).order('created_at', { ascending: false }).range(page * 50, page * 50 + 50);
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('order_number', `%${search}%`);
    return q(query) as Promise<Order[]>;
  }, [status, search, page]);
  return (
    <div>
      <PageHeader title="Orders" />
      <div className="mb-4 flex flex-wrap gap-2">
        <input placeholder="Order number" onKeyDown={(e) => e.key === 'Enter' && (setPage(0), setSearch((e.target as HTMLInputElement).value.trim()))} className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900" />
        <select value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900">
          <option value="">All statuses</option>{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <Card className="overflow-hidden">{loading ? <PageLoader /> : data?.length ? data.slice(0, 50).map((o) => <OrderRow key={o.id} o={o} viewer="admin" />) : <div className="p-6"><EmptyState icon={Briefcase} title="No orders" /></div>}</Card>
      <Pagination page={page} hasMore={(data?.length ?? 0) > 50} onPage={setPage} />
    </div>
  );
}

/* ---------------- Payments & refunds ---------------- */
interface AdminPayment { id: string; reference: string; amount: number; method: string; channel: PaymentChannel | null; status: PaymentStatus; payer_name: string | null; payer_reference: string | null; proof_path: string | null; rejection_reason: string | null; created_at: string; verified_at: string | null; order: { id: string; order_number: string; title: string; total_amount: number } | null; client: { full_name: string } | null }
interface AdminRefund { id: string; amount: number; reason: string; status: string; reference: string | null; created_at: string; order: { id: string; order_number: string } | null }
export function AdminPayments() {
  const toast = useToast();
  const [tab, setTab] = useState<'awaiting_verification' | 'paid' | 'rejected' | 'refunds'>('awaiting_verification');
  const { data, loading, reload } = useAsync(async () => {
    if (tab === 'refunds') return { refunds: await q(supabase.from('refunds').select('*, order:orders(id,order_number)').order('created_at', { ascending: false }).limit(100)) as AdminRefund[], payments: [] };
    return { payments: await q(supabase.from('payments').select('*, order:orders(id,order_number,title,total_amount), client:profiles!payments_client_id_fkey(full_name)').eq('status', tab).order('created_at', { ascending: tab === 'awaiting_verification' }).limit(100)) as AdminPayment[], refunds: [] };
  }, [tab]);
  const { act, busy } = useAct(reload);
  return (
    <div>
      <PageHeader title="Payments & refunds" subtitle="Approve only after the transaction ID shows on your bank, JazzCash, Easypaisa or Raast statement." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'awaiting_verification', label: 'To verify' }, { value: 'paid', label: 'Verified' }, { value: 'rejected', label: 'Rejected' }, { value: 'refunds', label: 'Refunds' }]} />
      <div className="mt-4">
        {loading ? <PageLoader /> : tab === 'refunds' ? (
          <Table head={['Order', 'Reason', 'Amount', 'Status', 'Action']} empty={!data?.refunds.length}>
            {data?.refunds.map((r) => (
              <tr key={r.id}>
                <td>{r.order && <Link to={`/admin/orders/${r.order.id}`} className="text-brand">{r.order.order_number}</Link>}<p className="text-xs text-muted">{dateTime(r.created_at)}</p></td>
                <td className="max-w-xs text-muted">{r.reason}</td>
                <td className="font-medium">{money(r.amount)}</td>
                <td><Badge tone={r.status === 'processed' ? 'green' : r.status === 'pending' ? 'amber' : 'red'}>{r.status}</Badge>{r.reference && <p className="text-xs text-muted">Ref {r.reference}</p>}</td>
                <td className="whitespace-nowrap">{r.status === 'pending' && <>
                  <Button size="sm" loading={busy === r.id} onClick={() => askPrompt(`Bank transfer reference for the ${money(r.amount)} refund:`, { confirmLabel: 'Mark refunded' }).then((ref) => { if (ref) act(r.id, () => rpc('admin_process_refund', { p_refund: r.id, p_approve: true, p_reference: ref }), 'Refund recorded'); })}>Mark refunded</Button>
                  <Button size="sm" variant="ghost" onClick={() => askPrompt('Why is this refund rejected?').then((n) => { if (n) act(r.id, () => rpc('admin_process_refund', { p_refund: r.id, p_approve: false, p_reference: n }), 'Refund rejected'); })}>Reject</Button>
                </>}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Table head={['Submitted', 'Order', 'Client / payer', 'Method / TID', 'Amount', 'Proof', 'Action']} empty={!data?.payments.length}>
            {data?.payments.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap text-muted">{dateTime(p.created_at)}<p className="font-mono text-[11px]">{p.reference}</p></td>
                <td>{p.order && <Link to={`/admin/orders/${p.order.id}`} className="text-brand">{p.order.order_number}</Link>}<p className="max-w-[180px] truncate text-xs text-muted">{p.order?.title}</p></td>
                <td>{p.client?.full_name}<p className="text-xs text-muted">Paid from: {p.payer_name ?? '—'}</p></td>
                <td><Badge tone="brand">{CHANNEL_META[p.channel ?? 'bank'].name}</Badge><p className="mt-1 font-mono text-xs">{p.payer_reference ?? '—'}</p></td>
                <td className="font-medium">{money(p.amount)}{p.order && Number(p.order.total_amount) !== Number(p.amount) && <p className="text-xs text-red-500">≠ order total</p>}</td>
                <td>{p.proof_path && <button onClick={() => openPrivateFile('payment-proofs', p.proof_path!).catch(toast.error)} className="inline-flex items-center gap-1 text-brand"><Eye className="h-4 w-4" />View</button>}</td>
                <td className="whitespace-nowrap">
                  {p.status === 'awaiting_verification' && p.method === 'bank_transfer' ? <>
                    <Button size="sm" loading={busy === p.id + 'a'} onClick={() => askConfirm(`Confirm ${money(p.amount)} with ${CHANNEL_META[p.channel ?? 'bank'].name} ID ${p.payer_reference} has arrived in the ${p.channel && p.channel !== 'bank' ? 'wallet' : 'business account'}?`, { confirmLabel: 'Yes, approve' }).then((ok) => { if (ok) act(p.id + 'a', () => rpc('admin_review_payment', { p_payment: p.id, p_approve: true }), 'Payment verified — order started'); })}><Check className="h-4 w-4" />Approve</Button>
                    <Button size="sm" variant="ghost" loading={busy === p.id + 'r'} onClick={() => askPrompt('Reason (shown to the client):', { confirmLabel: 'Reject payment' }).then((n) => { if (n) act(p.id + 'r', () => rpc('admin_review_payment', { p_payment: p.id, p_approve: false, p_note: n }), 'Payment rejected'); })}><X className="h-4 w-4" />Reject</Button>
                  </> : <><PaymentStatusBadge s={p.status} />{p.rejection_reason && <p className="text-xs text-muted">{p.rejection_reason}</p>}</>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

/* ---------------- Withdrawals ---------------- */
interface AdminWithdrawal { id: string; amount: number; status: WithdrawalStatus; payout_snapshot: { method: string; account_title: string; account_number: string; bank_name?: string }; admin_note: string | null; reference: string | null; created_at: string; freelancer: { id: string; full_name: string } | null }
const NEXT: Record<WithdrawalStatus, WithdrawalStatus[]> = { requested: ['under_review', 'approved', 'rejected'], under_review: ['approved', 'rejected'], approved: ['processing', 'rejected'], processing: ['paid', 'rejected'], paid: [], rejected: [] };
export function AdminWithdrawals() {
  const [open, setOpen] = useState(true);
  const [reveal, setReveal] = useState<Set<string>>(new Set());
  const { data, loading, reload } = useAsync(async () => {
    let query = supabase.from('withdrawals').select('*, freelancer:profiles!withdrawals_freelancer_id_fkey(id,full_name)').order('created_at', { ascending: !open }).limit(100);
    query = open ? query.in('status', ['requested', 'under_review', 'approved', 'processing']) : query.in('status', ['paid', 'rejected']);
    return q(query) as Promise<AdminWithdrawal[]>;
  }, [open]);
  const { act, busy } = useAct(reload);
  const move = async (w: AdminWithdrawal, s: WithdrawalStatus) => {
    let note: string | null = null; let ref: string | null = null;
    if (s === 'rejected') { note = await askPrompt('Reason (shown to the freelancer):'); if (!note) return; }
    if (s === 'paid') { ref = await askPrompt(`Transfer reference for ${money(w.amount)} sent to ${w.payout_snapshot.account_title}:`, { confirmLabel: 'Mark paid' }); if (!ref) return; }
    act(w.id, () => rpc('admin_update_withdrawal', { p_id: w.id, p_status: s, p_note: note, p_reference: ref }), `Withdrawal ${WITHDRAWAL_STATUS[s].label.toLowerCase()}`);
  };
  return (
    <div>
      <PageHeader title="Withdrawals" subtitle="Manual payouts: send the transfer from the business account, then mark it paid with the reference." />
      <Tabs value={open ? 'open' : 'done'} onChange={(v) => setOpen(v === 'open')} tabs={[{ value: 'open', label: 'Open' }, { value: 'done', label: 'Completed' }]} />
      <div className="mt-4">
        {loading ? <PageLoader /> : (
          <Table head={['Requested', 'Freelancer', 'Pay to', 'Amount', 'Status', 'Next step']} empty={!data?.length}>
            {data?.map((w) => (
              <tr key={w.id}>
                <td className="whitespace-nowrap text-muted">{dateTime(w.created_at)}</td>
                <td>{w.freelancer?.full_name}</td>
                <td className="text-xs">
                  <p className="font-medium capitalize">{w.payout_snapshot.method.replace('_', ' ')}{w.payout_snapshot.bank_name && ` · ${w.payout_snapshot.bank_name}`}</p>
                  <p>{w.payout_snapshot.account_title}</p>
                  <button className="font-mono text-brand" onClick={() => setReveal((s) => new Set(s).add(w.id))}>{reveal.has(w.id) ? w.payout_snapshot.account_number : `${mask(w.payout_snapshot.account_number)} (show)`}</button>
                </td>
                <td className="font-medium">{money(w.amount)}</td>
                <td><Badge tone={WITHDRAWAL_STATUS[w.status].tone}>{WITHDRAWAL_STATUS[w.status].label}</Badge>{w.reference && <p className="text-xs text-muted">Ref {w.reference}</p>}{w.admin_note && <p className="text-xs text-muted">{w.admin_note}</p>}</td>
                <td className="space-x-1 whitespace-nowrap">{NEXT[w.status].map((s) => <Button key={s} size="sm" variant={s === 'rejected' ? 'ghost' : s === 'paid' ? 'primary' : 'outline'} loading={busy === w.id} onClick={() => move(w, s)}>{WITHDRAWAL_STATUS[s].label}</Button>)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

/* ---------------- Disputes ---------------- */
interface AdminDispute { id: string; reason: string; details: string; status: string; resolution: string | null; outcome: string | null; created_at: string; opened_by: string; order: Order | null }
export function AdminDisputes() {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [resolve, setResolve] = useState<AdminDispute | null>(null);
  const [outcome, setOutcome] = useState('resume_order');
  const [note, setNote] = useState('');
  const { data, loading, reload } = useAsync(async () => q(supabase.from('disputes').select(`*, order:orders(${ORDER_LIST_SELECT})`)
    .in('status', tab === 'open' ? ['open', 'under_review'] : ['resolved', 'closed']).order('created_at', { ascending: false })) as Promise<AdminDispute[]>, [tab]);
  const { act, busy } = useAct(reload);
  return (
    <div>
      <PageHeader title="Disputes" subtitle="Review the order timeline, deliveries and conversation before deciding." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Resolved' }]} />
      <div className="mt-4 space-y-3">
        {loading ? <PageLoader /> : !data?.length ? <EmptyState icon={Gavel} title="No disputes" /> : data.map((d) => (
          <Card key={d.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2"><Badge tone="red">{d.reason.replace('_', ' ')}</Badge>{d.order && <OrderStatusBadge s={d.order.status} />}<span className="text-xs text-muted">{dateTime(d.created_at)}</span></div>
            {d.order && <p className="mt-2 font-medium"><Link to={`/admin/orders/${d.order.id}`} className="hover:text-brand">{d.order.order_number} · {d.order.title}</Link></p>}
            <p className="text-xs text-muted">{d.order?.client?.full_name} (client) vs {d.order?.freelancer?.full_name} (freelancer) · opened by {d.opened_by === d.order?.client_id ? 'client' : 'freelancer'} · {money(d.order?.total_amount)}</p>
            <p className="mt-3 whitespace-pre-line text-sm">{d.details}</p>
            {d.resolution && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-navy-900"><b>{d.outcome?.replace('_', ' ')}:</b> {d.resolution}</p>}
            {tab === 'open' && <Button className="mt-4" size="sm" onClick={() => { setResolve(d); setNote(''); setOutcome('resume_order'); }}>Resolve</Button>}
          </Card>
        ))}
      </div>
      <Modal open={!!resolve} onClose={() => setResolve(null)} title="Resolve dispute">
        <div className="space-y-4">
          <Select label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="resume_order">Resume the order (work continues)</option>
            <option value="complete_order">Complete the order (freelancer is paid)</option>
            <option value="refund_client">Cancel and refund the client</option>
          </Select>
          <Textarea label="Resolution note (sent to both parties)" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="w-full" loading={!!busy} onClick={async () => { if (await act('d', () => rpc('admin_resolve_dispute', { p_dispute: resolve!.id, p_outcome: outcome, p_resolution: note.trim() }), 'Dispute resolved')) setResolve(null); }}>Confirm</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- Reports, reviews, contact ---------------- */
interface Report { id: string; target_type: string; target_id: string; reason: string; details: string | null; status: string; admin_note: string | null; created_at: string; reporter: { full_name: string } | null }
export function AdminReports() {
  const [tab, setTab] = useState<'reports' | 'reviews' | 'contact'>('reports');
  const { data, loading, reload } = useAsync(async () => {
    if (tab === 'reports') return q(supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(full_name)').order('created_at', { ascending: false }).limit(100));
    if (tab === 'reviews') return q(supabase.from('reviews').select('*, client:profiles!reviews_client_id_fkey(full_name), freelancer:profiles!reviews_freelancer_id_fkey(full_name)').order('created_at', { ascending: false }).limit(100));
    return q(supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(100));
  }, [tab]);
  const { act } = useAct(reload);
  const link = (r: Report) => r.target_type === 'gig' ? `/gigs/${r.target_id}` : r.target_type === 'user' ? `/freelancers/${r.target_id}` : null;
  return (
    <div>
      <PageHeader title="Reports & moderation" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'reports', label: 'Reports' }, { value: 'reviews', label: 'Reviews' }, { value: 'contact', label: 'Contact messages' }]} />
      <div className="mt-4">
        {loading ? <PageLoader /> : tab === 'reports' ? (
          <Table head={['Reported', 'Target', 'Reason', 'Status', 'Action']} empty={!(data as Report[])?.length}>
            {(data as Report[]).map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-muted">{dateTime(r.created_at)}<p className="text-xs">by {r.reporter?.full_name}</p></td>
                <td><Badge>{r.target_type}</Badge> {link(r) ? <Link to={link(r)!} className="text-xs text-brand">open</Link> : <span className="font-mono text-[11px] text-muted">{r.target_id.slice(0, 8)}</span>}</td>
                <td><p className="font-medium">{r.reason.replace(/_/g, ' ')}</p>{r.details && <p className="max-w-xs text-xs text-muted">{r.details}</p>}</td>
                <td><Badge tone={r.status === 'open' ? 'amber' : 'slate'}>{r.status}</Badge>{r.admin_note && <p className="text-xs text-muted">{r.admin_note}</p>}</td>
                <td className="space-x-1 whitespace-nowrap">{['open', 'reviewing'].includes(r.status) && <>
                  <Button size="sm" variant="outline" onClick={() => askPrompt('What action was taken?').then((n) => { if (n) act(r.id, () => rpc('admin_update_report', { p_report: r.id, p_status: 'actioned', p_note: n }), 'Report closed'); })}>Actioned</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(r.id, () => rpc('admin_update_report', { p_report: r.id, p_status: 'dismissed', p_note: 'No violation' }), 'Report dismissed')}>Dismiss</Button>
                </>}</td>
              </tr>
            ))}
          </Table>
        ) : tab === 'reviews' ? (
          <Table head={['Date', 'Review', 'Rating', 'Visibility']} empty={!(data as unknown[])?.length}>
            {(data as (Report & { rating: number; comment: string | null; is_hidden: boolean; client: { full_name: string }; freelancer: { full_name: string } })[]).map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-muted">{dateTime(r.created_at)}</td>
                <td><p className="text-xs text-muted">{r.client?.full_name} → {r.freelancer?.full_name}</p><p className="max-w-md">{r.comment ?? '—'}</p></td>
                <td>{'★'.repeat(r.rating)}</td>
                <td><Button size="sm" variant={r.is_hidden ? 'outline' : 'ghost'} onClick={() => act(r.id, () => rpc('admin_moderate_review', { p_review: r.id, p_hidden: !r.is_hidden }), r.is_hidden ? 'Review restored' : 'Review hidden')}>{r.is_hidden ? 'Hidden — restore' : 'Hide'}</Button></td>
              </tr>
            ))}
          </Table>
        ) : (
          <Table head={['Date', 'From', 'Service', 'Message', '']} empty={!(data as unknown[])?.length}>
            {(data as { id: string; name: string; email: string; service: string | null; message: string; handled: boolean; created_at: string }[]).map((c) => (
              <tr key={c.id} className={c.handled ? 'opacity-60' : ''}>
                <td className="whitespace-nowrap text-muted">{dateTime(c.created_at)}</td>
                <td><p className="font-medium">{c.name}</p><a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-xs text-brand"><Mail className="h-3 w-3" />{c.email}</a></td>
                <td className="text-xs">{c.service ?? '—'}</td>
                <td className="max-w-md whitespace-pre-line text-xs">{c.message}</td>
                <td>{!c.handled && <Button size="sm" variant="outline" onClick={() => act(c.id, async () => { const { error } = await supabase.from('contact_messages').update({ handled: true }).eq('id', c.id); if (error) throw error; }, 'Marked handled')}>Done</Button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

/* ---------------- Transactions & audit logs ---------------- */
export function AdminLogs() {
  const [tab, setTab] = useState<'ledger' | 'audit' | 'payment_events'>('ledger');
  const { data, loading } = useAsync(async () => {
    if (tab === 'ledger') return q(supabase.from('ledger_entries').select('*, user:profiles!ledger_entries_user_id_fkey(full_name)').order('created_at', { ascending: false }).limit(200));
    if (tab === 'audit') return q(supabase.from('audit_logs').select('*, actor:profiles!audit_logs_actor_id_fkey(full_name)').order('created_at', { ascending: false }).limit(200));
    return q(supabase.from('payment_events').select('id,provider,event_type,signature_valid,created_at,payment_id').order('created_at', { ascending: false }).limit(200));
  }, [tab]);
  type Row = Record<string, unknown> & { id: number; created_at: string };
  const rows = (data ?? []) as Row[];
  return (
    <div>
      <PageHeader title="Transactions & audit logs" subtitle="Append-only records — they cannot be edited or deleted." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'ledger', label: 'Earnings ledger' }, { value: 'audit', label: 'Admin audit log' }, { value: 'payment_events', label: 'Payment webhooks' }]} />
      <div className="mt-4">
        {loading ? <PageLoader /> : tab === 'ledger' ? (
          <Table head={['Date', 'Freelancer', 'Type', 'Bucket', 'Description', 'Amount']} empty={!rows.length}>
            {rows.map((r) => <tr key={r.id}><td className="whitespace-nowrap text-muted">{dateTime(r.created_at)}</td><td>{(r.user as { full_name: string })?.full_name}</td><td className="text-xs">{String(r.kind)}</td><td><Badge tone={r.bucket === 'available' ? 'green' : 'amber'}>{String(r.bucket)}</Badge></td><td className="text-xs">{String(r.description)}</td>
              <td className={Number(r.amount) < 0 ? 'text-red-500' : 'text-emerald-600'}>{money(Number(r.amount))}</td></tr>)}
          </Table>
        ) : tab === 'audit' ? (
          <Table head={['Date', 'Admin', 'Action', 'Entity', 'Details']} empty={!rows.length}>
            {rows.map((r) => <tr key={r.id}><td className="whitespace-nowrap text-muted">{dateTime(r.created_at)}</td><td>{(r.actor as { full_name: string })?.full_name ?? 'system'}</td><td className="font-mono text-xs">{String(r.action)}</td><td className="text-xs">{String(r.entity)} <span className="font-mono text-muted">{String(r.entity_id ?? '').slice(0, 8)}</span></td><td className="max-w-sm truncate font-mono text-[11px] text-muted">{JSON.stringify(r.details)}</td></tr>)}
          </Table>
        ) : (
          <Table head={['Date', 'Provider', 'Event', 'Signature']} empty={!rows.length}>
            {rows.map((r) => <tr key={r.id}><td className="text-muted">{dateTime(r.created_at)}</td><td>{String(r.provider)}</td><td className="font-mono text-xs">{String(r.event_type)}</td><td><Badge tone={r.signature_valid ? 'green' : 'red'}>{r.signature_valid ? 'valid' : 'invalid'}</Badge></td></tr>)}
          </Table>
        )}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
export function AdminSettings() {
  const toast = useToast();
  const { data, loading, reload } = useSettings();
  const [s, setS] = useState<PlatformSettings | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <PageLoader />;
  const v = s ?? data!;
  const up = <K extends keyof PlatformSettings>(k: K, val: PlatformSettings[K]) => setS({ ...v, [k]: val });
  const save = async () => {
    setBusy(true);
    try {
      for (const k of Object.keys(v) as (keyof PlatformSettings)[]) {
        if (JSON.stringify(v[k]) !== JSON.stringify(data![k])) await rpc('admin_set_setting', { p_key: k, p_value: v[k] });
      }
      toast.success('Settings saved'); setS(null); reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const pct = (n: number) => Math.round(n * 1000) / 10;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Platform settings" subtitle="Changes are logged in the audit log." action={<Button loading={busy} onClick={save} disabled={!s}>Save changes</Button>} />
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-heading font-semibold"><CreditCard className="h-4 w-4 text-brand" />Fees</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Freelancer commission (%)" type="number" min={0} max={50} step={0.5} value={pct(v.commission_rate)} onChange={(e) => up('commission_rate', Number(e.target.value) / 100)} hint="Deducted from each completed order. Applies to new orders." />
          <Input label="Client service fee (%)" type="number" min={0} max={50} step={0.5} value={pct(v.client_service_fee_rate)} onChange={(e) => up('client_service_fee_rate', Number(e.target.value) / 100)} hint="Added at checkout above the free threshold." />
          <Input label="No client fee up to (PKR)" type="number" min={0} step={500} value={v.client_fee_free_threshold} onChange={(e) => up('client_fee_free_threshold', Number(e.target.value))} hint="Orders at or below this price have 0% client fee." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Rising Seller (%)" type="number" min={0} max={50} step={0.5} value={pct(v.level_commission.rising)} onChange={(e) => up('level_commission', { ...v.level_commission, rising: Number(e.target.value) / 100 })} />
            <Input label="Top Seller (%)" type="number" min={0} max={50} step={0.5} value={pct(v.level_commission.top)} onChange={(e) => up('level_commission', { ...v.level_commission, top: Number(e.target.value) / 100 })} />
          </div>
        </div>
        <p className="text-xs text-muted">Example: a PKR 15,000 order → client pays {money(15000 + (15000 > v.client_fee_free_threshold ? 15000 * v.client_service_fee_rate : 0))}, a new freelancer receives {money(15000 * (1 - v.commission_rate))}. Payment-gateway charges should be covered by the client fee.</p>
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="font-heading font-semibold">Founding Freelancer programme</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={v.founding_program.enabled} onChange={(e) => up('founding_program', { ...v.founding_program, enabled: e.target.checked })} />Give new freelancers the Founding badge and reduced commission</label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Commission during offer (%)" type="number" min={0} max={50} step={0.5} value={pct(v.founding_program.commission_rate)} onChange={(e) => up('founding_program', { ...v.founding_program, commission_rate: Number(e.target.value) / 100 })} />
          <Input label="Offer length (months)" type="number" min={1} max={24} value={v.founding_program.months} onChange={(e) => up('founding_program', { ...v.founding_program, months: Number(e.target.value) })} />
          <Input label="Places available" type="number" min={0} value={v.founding_program.slots} onChange={(e) => up('founding_program', { ...v.founding_program, slots: Number(e.target.value) })} />
        </div>
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="font-heading font-semibold">Credits & referrals</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Late-delivery credit (%)" type="number" min={0} max={50} step={1} value={pct(v.late_compensation_rate)} onChange={(e) => up('late_compensation_rate', Number(e.target.value) / 100)} hint="Of the order price, as a coupon" />
          <Input label="Referral reward (PKR each)" type="number" min={0} step={100} value={v.referral_reward.amount} onChange={(e) => up('referral_reward', { ...v.referral_reward, amount: Number(e.target.value) })} />
          <Input label="Referral minimum order (PKR)" type="number" min={0} step={500} value={v.referral_reward.min_order} onChange={(e) => up('referral_reward', { ...v.referral_reward, min_order: Number(e.target.value) })} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={v.referral_reward.enabled} onChange={(e) => up('referral_reward', { ...v.referral_reward, enabled: e.target.checked })} />Referral programme on</label>
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-heading font-semibold"><ArrowDownToLine className="h-4 w-4 text-brand" />Earnings & orders</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Clearance period (days)" type="number" min={0} max={60} value={v.clearance_days} onChange={(e) => up('clearance_days', Number(e.target.value))} />
          <Input label="Minimum withdrawal (PKR)" type="number" min={0} value={v.min_withdrawal} onChange={(e) => up('min_withdrawal', Number(e.target.value))} />
          <Input label="Auto-complete after (days)" type="number" min={1} max={30} value={v.auto_complete_days} onChange={(e) => up('auto_complete_days', Number(e.target.value))} />
          <Input label="Payout time (business days)" type="number" min={1} max={30} value={v.payout_sla_days} onChange={(e) => up('payout_sla_days', Number(e.target.value))} hint="Shown to freelancers as the expected payment date" />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={v.gig_moderation} onChange={(e) => up('gig_moderation', e.target.checked)} />Require admin approval before gigs go live</label>
      </Card>
      <Card className="space-y-5 p-6">
        <div>
          <h2 className="flex items-center gap-2 font-heading font-semibold"><Banknote className="h-4 w-4 text-brand" />Payment methods (Pakistan, PKR only)</h2>
          <p className="mt-1 text-xs text-muted">Clients see only the methods you switch on and fill in. Use business accounts and only enter details every client may see.</p>
        </div>
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-navy-700">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-brand" checked={v.payment_channels.bank.enabled} onChange={(e) => up('payment_channels', { ...v.payment_channels, bank: { ...v.payment_channels.bank, enabled: e.target.checked } })} />Bank transfer (IBFT)</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="bank-title" label="Account title" value={v.bank_instructions.account_title} onChange={(e) => up('bank_instructions', { ...v.bank_instructions, account_title: e.target.value })} />
            <Input id="bank-name" label="Bank name" value={v.bank_instructions.bank_name} onChange={(e) => up('bank_instructions', { ...v.bank_instructions, bank_name: e.target.value })} />
            <Input id="bank-iban" label="IBAN (PK…)" value={v.bank_instructions.iban} onChange={(e) => up('bank_instructions', { ...v.bank_instructions, iban: e.target.value.toUpperCase().replace(/\s/g, '') })}
              error={v.bank_instructions.iban && !/^PK\d{2}[A-Z]{4}\d{16}$/.test(v.bank_instructions.iban) ? 'Pakistani IBANs are PK + 22 characters' : undefined} />
            <Input id="bank-acc" label="Account number" value={v.bank_instructions.account_number} onChange={(e) => up('bank_instructions', { ...v.bank_instructions, account_number: e.target.value })} />
          </div>
          <Textarea id="bank-notes" label="Notes for the client" rows={2} value={v.bank_instructions.notes} onChange={(e) => up('bank_instructions', { ...v.bank_instructions, notes: e.target.value })} />
        </fieldset>
        {(['jazzcash', 'easypaisa'] as const).map((k) => (
          <fieldset key={k} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-navy-700">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-brand" checked={v.payment_channels[k].enabled} onChange={(e) => up('payment_channels', { ...v.payment_channels, [k]: { ...v.payment_channels[k], enabled: e.target.checked } })} />{k === 'jazzcash' ? 'JazzCash' : 'Easypaisa'} (mobile account)</label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id={`${k}-title`} label="Account title" value={v.payment_channels[k].account_title} onChange={(e) => up('payment_channels', { ...v.payment_channels, [k]: { ...v.payment_channels[k], account_title: e.target.value } })} />
              <Input id={`${k}-number`} label="Mobile number" placeholder="03XXXXXXXXX" value={v.payment_channels[k].number} onChange={(e) => up('payment_channels', { ...v.payment_channels, [k]: { ...v.payment_channels[k], number: e.target.value.replace(/[^\d]/g, '') } })}
                error={v.payment_channels[k].number && !/^03\d{9}$/.test(v.payment_channels[k].number) ? 'Use the 11-digit format 03XXXXXXXXX' : undefined} />
            </div>
          </fieldset>
        ))}
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-navy-700">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-brand" checked={v.payment_channels.raast.enabled} onChange={(e) => up('payment_channels', { ...v.payment_channels, raast: { ...v.payment_channels.raast, enabled: e.target.checked } })} />Raast (instant State Bank payments)</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="raast-title" label="Account title" value={v.payment_channels.raast.account_title} onChange={(e) => up('payment_channels', { ...v.payment_channels, raast: { ...v.payment_channels.raast, account_title: e.target.value } })} />
            <Input id="raast-id" label="Raast ID (registered mobile number)" placeholder="03XXXXXXXXX" value={v.payment_channels.raast.raast_id} onChange={(e) => up('payment_channels', { ...v.payment_channels, raast: { ...v.payment_channels.raast, raast_id: e.target.value.replace(/[^\d]/g, '') } })} />
          </div>
        </fieldset>
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="font-heading font-semibold">Instant online payments (card / wallets)</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={v.online_payments_enabled} onChange={(e) => up('online_payments_enabled', e.target.checked)} />Show “Pay instantly” at checkout</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Gateway" value={v.online_gateway.provider} onChange={(e) => up('online_gateway', { ...v.online_gateway, provider: e.target.value })}>
            <option value="">Not connected</option><option value="safepay">Safepay</option><option value="payfast">PayFast</option><option value="other">Other Pakistani gateway</option>
          </Select>
          <Input label="Button label for clients" value={v.online_gateway.label} onChange={(e) => up('online_gateway', { ...v.online_gateway, label: e.target.value })} maxLength={60} />
        </div>
        <p className="text-xs text-muted">Switch this on only after your merchant account is approved and a test payment has gone through end-to-end. Manual bank, JazzCash, Easypaisa and Raast transfers stay available as a backup.</p>
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="font-heading font-semibold">Contact details on the website</h2>
        <p className="text-xs text-muted">Shown in the footer, contact page, policies and emails. Use your domain email (e.g. support@yourdomain.com) instead of Gmail.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Support email" type="email" value={v.site_contact?.email ?? ''} onChange={(e) => up('site_contact', { ...v.site_contact, email: e.target.value.trim() })} />
          <Input label="Phone" value={v.site_contact?.phone ?? ''} onChange={(e) => up('site_contact', { ...v.site_contact, phone: e.target.value })} />
          <Input label="WhatsApp number (with country code)" placeholder="923001234567" value={v.site_contact?.whatsapp ?? ''} onChange={(e) => up('site_contact', { ...v.site_contact, whatsapp: e.target.value.replace(/[^\d]/g, '') })} />
          <Input label="Support hours" value={v.support_hours} onChange={(e) => up('support_hours', e.target.value)} />
        </div>
        <Input label="Office address" value={v.site_contact?.address ?? ''} onChange={(e) => up('site_contact', { ...v.site_contact, address: e.target.value })} />
        <Input label="Consultation booking link (optional)" placeholder="https://calendly.com/your-name/consultation" value={v.booking_url} onChange={(e) => up('booking_url', e.target.value.trim())} hint="Shown next to the free consultation form" />
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="font-heading font-semibold">Company registration details</h2>
        <p className="text-xs text-muted">Shown on the About page once filled in — builds trust with clients.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Registered business name" value={v.company_info.legal_name} onChange={(e) => up('company_info', { ...v.company_info, legal_name: e.target.value })} />
          <Input label="SECP / registration no." value={v.company_info.registration} onChange={(e) => up('company_info', { ...v.company_info, registration: e.target.value })} />
          <Input label="NTN" value={v.company_info.ntn} onChange={(e) => up('company_info', { ...v.company_info, ntn: e.target.value })} />
          <Input label="Registered address" value={v.company_info.address} onChange={(e) => up('company_info', { ...v.company_info, address: e.target.value })} />
        </div>
      </Card>
    </div>
  );
}
