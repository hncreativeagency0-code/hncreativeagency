import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Smartphone, Zap, Copy, Upload, ShieldCheck, AlertTriangle, Clock, Check, CreditCard, Lock } from 'lucide-react';
import { supabase, rpc, errorMessage } from '@/lib/supabase';
import { useSiteContact } from '@/lib/site';
import { track } from '@/lib/analytics';
import { GuaranteeNote } from '@/components/marketing';
import { useAsync, useSettings, q, type PaymentChannel, type PlatformSettings } from '@/lib/hooks';
import { uploadFile } from '@/lib/storage';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Order } from '@/lib/types';
import { Button, Card, EmptyState, ErrorBox, Input, PageHeader, PageLoader } from '@/components/ui';
import { cn, money } from '@/lib/utils';

export const CHANNEL_META: Record<PaymentChannel, { name: string; icon: typeof Building2; refLabel: string; refHint: string; payerLabel: string }> = {
  bank: { name: 'Bank transfer', icon: Building2, refLabel: 'Transaction / reference ID', refHint: 'Shown on your bank app receipt (IBFT ref, RRN or STAN).', payerLabel: 'Account holder name you paid from' },
  jazzcash: { name: 'JazzCash', icon: Smartphone, refLabel: 'JazzCash TID', refHint: 'The transaction ID in your JazzCash SMS or app receipt.', payerLabel: 'Name on your JazzCash account' },
  easypaisa: { name: 'Easypaisa', icon: Smartphone, refLabel: 'Easypaisa transaction ID', refHint: 'The transaction ID in your Easypaisa SMS or app receipt.', payerLabel: 'Name on your Easypaisa account' },
  raast: { name: 'Raast', icon: Zap, refLabel: 'Raast transaction ID', refHint: 'Shown on your bank app receipt after the Raast payment.', payerLabel: 'Account holder name you paid from' },
};

/** Which channels are switched on and fully filled in by the admin. */
export function readyChannels(s: PlatformSettings | null): PaymentChannel[] {
  if (!s) return [];
  const c = s.payment_channels; const b = s.bank_instructions;
  const out: PaymentChannel[] = [];
  if ((c?.bank?.enabled ?? true) && b?.account_title && (b.iban || b.account_number)) out.push('bank');
  if (c?.jazzcash?.enabled && c.jazzcash.account_title && c.jazzcash.number) out.push('jazzcash');
  if (c?.easypaisa?.enabled && c.easypaisa.account_title && c.easypaisa.number) out.push('easypaisa');
  if (c?.raast?.enabled && c.raast.account_title && c.raast.raast_id) out.push('raast');
  return out;
}

export default function Checkout() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const settings = useSettings();
  const [channel, setChannel] = useState<PaymentChannel | null>(null);
  const [payer, setPayer] = useState('');
  const [ref, setRef] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const contact = useSiteContact();

  const { data, loading, error, reload } = useAsync(async () => {
    const order = await q(supabase.from('orders').select('*').eq('id', id!).maybeSingle()) as Order | null;
    const lastPayment = order ? await q(supabase.from('payments').select('status,rejection_reason,reference,created_at').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle()) : null;
    return { order, lastPayment: lastPayment as { status: string; rejection_reason: string | null; reference: string } | null };
  }, [id]);

  if (loading || settings.loading) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const o = data?.order;
  if (!o || o.client_id !== user?.id) return <EmptyState title="Order not found" />;
  if (o.status !== 'pending_payment' || o.payment_status === 'awaiting_verification') {
    return <EmptyState title={o.payment_status === 'awaiting_verification' ? 'Payment is being verified' : 'This order does not need payment'}
      text="You can follow progress on the order page." action={<Link to={`/app/orders/${o.id}`} className="font-medium text-brand">Open order →</Link>} />;
  }

  const s = settings.data!;
  const available = readyChannels(s);
  const active = channel && available.includes(channel) ? channel : available[0] ?? null;
  const meta = active ? CHANNEL_META[active] : null;
  const c = s.payment_channels;
  const details: [string, string][] = !active ? [] :
    active === 'bank' ? [['Account title', s.bank_instructions.account_title], ['Bank', s.bank_instructions.bank_name], ['IBAN', s.bank_instructions.iban], ['Account number', s.bank_instructions.account_number]]
    : active === 'raast' ? [['Account title', c.raast.account_title], ['Raast ID', c.raast.raast_id]]
    : [['Account title', c[active].account_title], [`${CHANNEL_META[active].name} number`, c[active].number]];

  const online = s.online_payments_enabled && !!s.online_gateway?.provider;
  const payOnline = async () => {
    setPaying(true);
    try {
      track('add_payment_info', { value: o.total_amount, method: 'online' });
      const { data: res, error: err } = await supabase.functions.invoke('create-payment-session', { body: { order_id: o.id } });
      if (err) throw err;
      const url = (res as { checkout_url?: string } | null)?.checkout_url;
      if (!url) throw new Error('Online payment is not available right now. Please use one of the transfer options below.');
      if (url.startsWith('/')) nav(url); else window.location.assign(url);
    } catch (e) { toast.error(errorMessage(e).includes('Something went wrong') ? 'Online payment is not available right now. Please use one of the transfer options below.' : e); } finally { setPaying(false); }
  };

  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success('Copied'), () => toast.info(t));

  const submit = async () => {
    if (!active || !meta) return;
    if (payer.trim().length < 2) return toast.error(`Enter the ${meta.payerLabel.toLowerCase()}`);
    if (ref.trim().length < 4) return toast.error(`Enter the ${meta.refLabel}`);
    if (!proof) return toast.error('Upload a screenshot of the payment receipt');
    if (!/^(image\/(png|jpeg|webp)|application\/pdf)$/.test(proof.type)) return toast.error('Receipt must be PNG, JPG, WEBP or PDF');
    setBusy(true);
    try {
      const file = await uploadFile('payment-proofs', `${o.id}/${user!.id}`, proof);
      await rpc('submit_bank_transfer', { p_order: o.id, p_payer_name: payer.trim(), p_payer_reference: ref.trim(), p_proof_path: file.path, p_channel: active });
      track('add_payment_info', { value: o.total_amount, method: active });
      toast.success('Payment submitted for verification');
      nav(`/app/orders/${o.id}`);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Checkout" subtitle={`${o.order_number} · ${o.title}`} />
      {data?.lastPayment?.status === 'rejected' && (
        <div className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div><p className="font-medium">Your previous payment could not be verified.</p><p>{data.lastPayment.rejection_reason}</p></div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          {online && (
            <Card className="border-brand/40 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <h2 className="flex items-center gap-2 font-heading font-semibold"><Zap className="h-5 w-5 text-brand" />Pay instantly</h2>
                  <p className="mt-1 text-sm text-muted">{s.online_gateway.label} — confirmed in seconds, your order starts right away.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">{(s.online_gateway.methods ?? []).map((m) => <span key={m} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 dark:border-navy-700">{m === 'card' ? <CreditCard className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}{({ card: 'Debit / credit card', jazzcash: 'JazzCash', easypaisa: 'Easypaisa', raast: 'Raast' } as Record<string, string>)[m] ?? m}</span>)}</div>
                </div>
                <Button size="lg" loading={paying} onClick={payOnline}><Lock className="h-4 w-4" />Pay {money(o.total_amount)}</Button>
              </div>
              <p className="mt-3 text-xs text-muted">You’ll complete payment on our payment partner’s secure page. HN never sees your card number or PIN.</p>
            </Card>
          )}
          <Card className="p-6">
            <h2 className="font-heading font-semibold">{online ? 'Or pay by transfer' : 'How would you like to pay?'}</h2>
            <p className="mt-1 text-sm text-muted">{online ? 'Send money from any Pakistani bank or wallet — we confirm it within a few business hours.' : 'Payments are accepted in Pakistani Rupees from Pakistani banks and mobile wallets.'}</p>
            {available.length === 0 ? (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                Transfer details are being updated. Message us on <a href={contact.whatsappUrl} className="font-medium underline">WhatsApp</a> or email {contact.email} and we’ll help you pay right away.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Payment method">
                {available.map((ch) => {
                  const M = CHANNEL_META[ch]; const on = ch === active;
                  return (
                    <button key={ch} type="button" role="radio" aria-checked={on} onClick={() => setChannel(ch)}
                      className={cn('relative flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left text-sm font-medium transition',
                        on ? 'border-brand bg-brand-50 text-brand-700 dark:bg-brand/10 dark:text-brand-200' : 'border-slate-200 hover:border-slate-300 dark:border-navy-700')}>
                      <M.icon className="h-5 w-5" />{M.name}
                      {on && <Check className="absolute right-2 top-2 h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {active && meta && (
            <>
              <Card className="p-6">
                <h2 className="flex items-center gap-2 font-heading font-semibold"><meta.icon className="h-5 w-5 text-brand" />Send {money(o.total_amount)} by {meta.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {active === 'bank' ? 'Use IBFT from any Pakistani bank app.' : active === 'raast' ? 'Pay to the Raast ID from your bank app — it arrives instantly.' : `Send money to this ${meta.name} account from your ${meta.name} app or any bank app.`}
                  {' '}Send the exact amount and write <b className="text-navy dark:text-white">{o.order_number}</b> in the purpose/remarks if your app allows it.
                </p>
                <dl className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-navy-700 dark:border-navy-700">
                  {[...details, ['Amount', money(o.total_amount)] as [string, string], ['Reference', o.order_number] as [string, string]].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <dt className="text-muted">{k}</dt>
                      <dd className="flex min-w-0 items-center gap-2 font-medium"><span className="break-all text-right">{v}</span>
                        <button onClick={() => copy(k === 'Amount' ? String(o.total_amount) : v)} aria-label={`Copy ${k}`} className="shrink-0 text-muted hover:text-brand"><Copy className="h-4 w-4" /></button></dd>
                    </div>
                  ))}
                </dl>
                {active === 'bank' && s.bank_instructions.notes && <p className="mt-3 text-sm text-muted">{s.bank_instructions.notes}</p>}
              </Card>
              <Card className="space-y-4 p-6">
                <h2 className="font-heading font-semibold">Confirm your payment</h2>
                <Input id="payer-name" label={meta.payerLabel} value={payer} onChange={(e) => setPayer(e.target.value)} maxLength={80} required />
                <Input id="payer-ref" label={meta.refLabel} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={80} required hint={meta.refHint} />
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Receipt screenshot <span className="text-red-500">*</span></label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm hover:border-brand dark:border-navy-700">
                    <Upload className="h-5 w-5 shrink-0 text-brand" /><span className="min-w-0 flex-1 truncate">{proof ? proof.name : 'Choose image or PDF (max 10 MB)'}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <Button size="lg" className="w-full" loading={busy} onClick={submit}>Submit for verification</Button>
                <p className="flex items-start gap-2 text-xs text-muted"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />Our team matches the transaction ID with the account statement, usually within a few business hours. Your order starts only after it is confirmed.</p>
              </Card>
            </>
          )}
        </div>
        <aside>
          <Card className="sticky top-24 p-5">
            <h2 className="font-heading font-semibold">Order summary</h2>
            <p className="mt-2 text-sm">{o.title}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Price</dt><dd>{money(o.price)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Service fee</dt><dd>{Number(o.service_fee) ? money(o.service_fee) : <span className="font-medium text-emerald-600">Free</span>}</dd></div>
              {Number(o.discount_amount) > 0 && <div className="flex justify-between text-emerald-600"><dt>Coupon discount</dt><dd>−{money(o.discount_amount)}</dd></div>}
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold dark:border-navy-700"><dt>Total (PKR)</dt><dd>{money(o.total_amount)}</dd></div>
              <div className="flex justify-between pt-2 text-muted"><dt>Delivery</dt><dd>{o.delivery_days} days after start</dd></div>
            </dl>
            <GuaranteeNote className="mt-4 !text-xs" />
            <p className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs text-muted dark:bg-navy-900"><ShieldCheck className="h-4 w-4 shrink-0 text-brand" />Pay only to the accounts shown here. Never send money to a freelancer's personal number.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
