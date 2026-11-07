import { askConfirm } from '@/context/DialogContext';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet as WalletIcon, Clock, TrendingUp, Percent, ArrowDownToLine, Plus, Trash2, Star, Landmark, Info, CalendarClock, Check } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAsync, usePublicSettings, q } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { WithdrawalStatus } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Select, StatCard, Tabs } from '@/components/ui';
import { cn, date, dateTime, money, WITHDRAWAL_STATUS } from '@/lib/utils';

interface Summary { pending: number; available: number; total_earned: number; total_commission: number; withdrawn: number; in_withdrawal: number; clearance_days: number; min_withdrawal: number }
interface Ledger { id: number; kind: string; bucket: string; amount: number; description: string; created_at: string; order_id: string | null }
interface Method { id: string; method: string; account_title: string; bank_name: string | null; account_number: string; is_default: boolean }
interface Withdrawal { id: string; amount: number; status: WithdrawalStatus; payout_snapshot: { method: string; account_title: string; account_number: string; bank_name?: string }; admin_note: string | null; reference: string | null; created_at: string; paid_at: string | null }

const METHOD_LABEL: Record<string, string> = { bank_account: 'Bank account (IBAN)', jazzcash: 'JazzCash', easypaisa: 'Easypaisa', raast: 'Raast ID' };
export const mask = (n: string) => (n.length <= 4 ? n : `•••• ${n.slice(-4)}`);

/** Adds business days (Mon–Fri) to a date. */
export function addBusinessDays(from: string | Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) { d.setDate(d.getDate() + 1); const wd = d.getDay(); if (wd !== 0 && wd !== 6) left--; }
  return d;
}
const STEPS: WithdrawalStatus[] = ['requested', 'approved', 'processing', 'paid'];
function PayoutSteps({ status }: { status: WithdrawalStatus }) {
  if (status === 'rejected') return <Badge tone="red">Rejected — amount returned to your balance</Badge>;
  const at = Math.max(0, STEPS.indexOf(status === 'under_review' ? 'requested' : status));
  return (
    <ol className="flex items-center gap-1 text-[11px]">
      {STEPS.map((st, i) => (
        <li key={st} className="flex items-center gap-1">
          <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', i <= at ? 'bg-brand text-white' : 'bg-slate-200 text-muted dark:bg-navy-700')}>{i < at || status === 'paid' ? <Check className="h-3 w-3" /> : i + 1}</span>
          <span className={cn('hidden capitalize sm:inline', i <= at ? 'font-medium' : 'text-muted')}>{WITHDRAWAL_STATUS[st].label}</span>
          {i < STEPS.length - 1 && <span className={cn('h-px w-4 sm:w-6', i < at ? 'bg-brand' : 'bg-slate-200 dark:bg-navy-700')} />}
        </li>
      ))}
    </ol>
  );
}

export default function Wallet() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'ledger' | 'withdrawals' | 'methods'>('ledger');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [m, setM] = useState({ method: 'bank_account', account_title: '', bank_name: '', account_number: '' });
  const [busy, setBusy] = useState(false);
  const settings = usePublicSettings();
  const sla = settings?.payout_sla_days ?? 3;

  const { data, loading, error, reload } = useAsync(async () => {
    await rpc('release_cleared_earnings').catch(() => 0);
    const [summary, ledger, methods, withdrawals] = await Promise.all([
      rpc<Summary[]>('get_wallet_summary'),
      q(supabase.from('ledger_entries').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(200)),
      q(supabase.from('payout_methods').select('*').eq('user_id', user!.id).order('created_at')),
      q(supabase.from('withdrawals').select('*').eq('freelancer_id', user!.id).order('created_at', { ascending: false })),
    ]);
    return { s: summary[0], ledger: ledger as Ledger[], methods: methods as Method[], withdrawals: withdrawals as Withdrawal[] };
  }, [user?.id]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const { s, ledger, methods, withdrawals } = data!;
  const openWithdrawal = withdrawals.find((w) => ['requested', 'under_review', 'approved', 'processing'].includes(w.status));
  const released = new Set(ledger.filter((l) => l.kind === 'release' && l.order_id).map((l) => l.order_id));
  const upcoming = ledger.filter((l) => l.kind === 'order_earning' && l.bucket === 'pending' && l.order_id && !released.has(l.order_id))
    .map((l) => ({ ...l, clears: new Date(new Date(l.created_at).getTime() + s.clearance_days * 86_400_000) }))
    .sort((a, b) => a.clears.getTime() - b.clears.getTime());

  const withdraw = async () => {
    setBusy(true);
    try { await rpc('request_withdrawal', { p_amount: Number(amount), p_method: methodId || methods.find((x) => x.is_default)?.id || methods[0]?.id }); toast.success('Withdrawal requested'); setWithdrawOpen(false); setAmount(''); reload(); }
    catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const addMethod = async () => {
    if (m.account_title.trim().length < 3) return toast.error('Enter the account title exactly as on the account');
    const num = m.account_number.replace(/\s/g, '');
    if (m.method === 'bank_account' && !/^PK\d{2}[A-Z]{4}\d{16}$/i.test(num)) return toast.error('Enter a valid Pakistani IBAN (PK + 22 characters)');
    if ((m.method === 'jazzcash' || m.method === 'easypaisa') && !/^03\d{9}$/.test(num)) return toast.error('Enter the 11-digit mobile number (03XXXXXXXXX)');
    setBusy(true);
    const { error } = await supabase.from('payout_methods').insert({ user_id: user!.id, method: m.method, account_title: m.account_title.trim(), bank_name: m.bank_name.trim() || null, account_number: num.toUpperCase(), is_default: methods.length === 0 });
    setBusy(false);
    if (error) return toast.error(error);
    toast.success('Payout method added'); setMethodOpen(false); setM({ method: 'bank_account', account_title: '', bank_name: '', account_number: '' }); reload();
  };
  const setDefault = async (id: string) => {
    await supabase.from('payout_methods').update({ is_default: false }).eq('user_id', user!.id);
    const { error } = await supabase.from('payout_methods').update({ is_default: true }).eq('id', id);
    if (error) toast.error(error); else reload();
  };
  const removeMethod = async (id: string) => {
    if (!(await askConfirm('Remove this payout method?', { danger: true, confirmLabel: 'Remove' }))) return;
    const { error } = await supabase.from('payout_methods').delete().eq('id', id);
    if (error) toast.error(error); else reload();
  };

  return (
    <div>
      <PageHeader title="Earnings & wallet" subtitle="Every change to your balance is recorded in the ledger below."
        action={<Button onClick={() => setWithdrawOpen(true)} disabled={!!openWithdrawal || s.available < s.min_withdrawal}><ArrowDownToLine className="h-4 w-4" />Withdraw</Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Available to withdraw" value={money(s.available)} icon={WalletIcon} hint={`Minimum withdrawal ${money(s.min_withdrawal)}`} />
        <StatCard label="Pending clearance" value={money(s.pending)} icon={Clock} hint={`Clears ${s.clearance_days} days after completion`} />
        <StatCard label="Total earned (net)" value={money(s.total_earned)} icon={TrendingUp} hint={`${money(s.withdrawn)} withdrawn`} />
        <StatCard label="Commission paid" value={money(s.total_commission)} icon={Percent} />
      </div>
      {openWithdrawal && (
        <Card className="mt-5 flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center">
          <Info className="h-5 w-5 shrink-0 text-brand" />
          <span className="flex-1">Withdrawal of <b>{money(openWithdrawal.amount)}</b> — expected in your account by <b>{date(addBusinessDays(openWithdrawal.created_at, sla).toISOString())}</b>.</span>
          <PayoutSteps status={openWithdrawal.status} />
        </Card>
      )}
      {upcoming.length > 0 && (
        <Card className="mt-5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-brand" />Upcoming releases</p>
          <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-navy-700">
            {upcoming.slice(0, 5).map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-muted">{u.description}</span>
                <span className="shrink-0"><b className="text-navy dark:text-white">{money(u.amount)}</b> <span className="text-muted">on {date(u.clears.toISOString())}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="mt-6"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'ledger', label: 'Transactions' }, { value: 'withdrawals', label: 'Withdrawals', count: withdrawals.length }, { value: 'methods', label: 'Payout methods', count: methods.length }]} /></div>

      {tab === 'ledger' && (
        <Card className="mt-4 overflow-x-auto">
          {ledger.length === 0 ? <div className="p-6"><EmptyState title="No transactions yet" text="Earnings from completed orders will appear here." /></div> : (
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs uppercase text-muted dark:border-navy-700"><th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Balance</th><th className="p-3 text-right">Amount</th></tr></thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0 dark:border-navy-700/50">
                    <td className="whitespace-nowrap p-3 text-muted">{dateTime(l.created_at)}</td>
                    <td className="p-3">{l.description}{l.order_id && <Link to={`/app/orders/${l.order_id}`} className="ml-1 text-brand">→</Link>}</td>
                    <td className="p-3"><Badge tone={l.bucket === 'available' ? 'green' : 'amber'}>{l.bucket}</Badge></td>
                    <td className={`p-3 text-right font-medium ${l.amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{l.amount > 0 ? '+' : ''}{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'withdrawals' && (
        <Card className="mt-4 divide-y divide-slate-100 dark:divide-navy-700">
          {withdrawals.length === 0 ? <div className="p-6"><EmptyState title="No withdrawals yet" /></div> : withdrawals.map((w) => (
            <div key={w.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-medium">{money(w.amount)} → {METHOD_LABEL[w.payout_snapshot.method]} {mask(w.payout_snapshot.account_number)}</p>
                <p className="text-xs text-muted">Requested {dateTime(w.created_at)}{w.paid_at ? ` · Paid ${dateTime(w.paid_at)}` : w.status !== 'rejected' ? ` · Expected by ${date(addBusinessDays(w.created_at, sla).toISOString())}` : ''}{w.reference && ` · Ref ${w.reference}`}</p>
                {w.admin_note && <p className="mt-1 text-xs text-muted">Note: {w.admin_note}</p>}
              </div>
              <PayoutSteps status={w.status} />
            </div>
          ))}
        </Card>
      )}

      {tab === 'methods' && (
        <div className="mt-4 space-y-3">
          {methods.map((x) => (
            <Card key={x.id} className="flex items-center gap-4 p-4">
              <Landmark className="h-6 w-6 text-brand" />
              <div className="flex-1"><p className="font-medium">{METHOD_LABEL[x.method]}{x.bank_name && ` · ${x.bank_name}`}</p><p className="text-sm text-muted">{x.account_title} · {mask(x.account_number)}</p></div>
              {x.is_default ? <Badge tone="brand"><Star className="h-3 w-3" />Default</Badge> : <Button size="sm" variant="ghost" onClick={() => setDefault(x.id)}>Make default</Button>}
              <button onClick={() => removeMethod(x.id)} aria-label="Remove method"><Trash2 className="h-4 w-4 text-muted hover:text-red-500" /></button>
            </Card>
          ))}
          <Button variant="outline" onClick={() => setMethodOpen(true)}><Plus className="h-4 w-4" />Add payout method</Button>
          <p className="text-xs text-muted">We only store the account title and number needed to send you money. Never share PINs, passwords or OTPs with anyone.</p>
        </div>
      )}

      <Modal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Request a withdrawal">
        {methods.length === 0 ? (
          <div className="space-y-3 text-sm"><p>Add a payout method first.</p><Button onClick={() => { setWithdrawOpen(false); setTab('methods'); setMethodOpen(true); }}>Add payout method</Button></div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">Available: <b className="text-navy dark:text-white">{money(s.available)}</b></p>
            <Input label="Amount (PKR)" type="number" min={s.min_withdrawal} max={s.available} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button className="text-xs font-medium text-brand" onClick={() => setAmount(String(s.available))}>Withdraw full balance</button>
            <Select label="Send to" value={methodId || methods.find((x) => x.is_default)?.id || methods[0].id} onChange={(e) => setMethodId(e.target.value)}>
              {methods.map((x) => <option key={x.id} value={x.id}>{METHOD_LABEL[x.method]} · {x.account_title} · {mask(x.account_number)}</option>)}
            </Select>
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-muted dark:bg-navy-900">Expected in your account within {sla} business days (by {date(addBusinessDays(new Date(), sla).toISOString())}). The amount is held from your balance until paid, or returned if the request is rejected.</p>
            <Button className="w-full" loading={busy} onClick={withdraw} disabled={!(Number(amount) >= s.min_withdrawal && Number(amount) <= s.available)}>Request {amount ? money(amount) : 'withdrawal'}</Button>
          </div>
        )}
      </Modal>
      <Modal open={methodOpen} onClose={() => setMethodOpen(false)} title="Add payout method">
        <div className="space-y-4">
          <Select label="Type" value={m.method} onChange={(e) => setM({ ...m, method: e.target.value })}>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Account title" value={m.account_title} onChange={(e) => setM({ ...m, account_title: e.target.value })} maxLength={80} required />
          {m.method === 'bank_account' && <Input label="Bank name" value={m.bank_name} onChange={(e) => setM({ ...m, bank_name: e.target.value })} maxLength={80} />}
          <Input label={m.method === 'bank_account' ? 'IBAN' : m.method === 'raast' ? 'Raast ID / IBAN' : 'Mobile number'} placeholder={m.method === 'bank_account' ? 'PK36SCBL0000001123456702' : '03XXXXXXXXX'}
            value={m.account_number} onChange={(e) => setM({ ...m, account_number: e.target.value })} maxLength={34} required />
          <Button className="w-full" loading={busy} onClick={addMethod}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}
