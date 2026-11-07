import { askConfirm } from '@/context/DialogContext';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Upload, Download, CheckCircle2, RotateCcw, AlertTriangle, CreditCard, X, FileText, Clock, Star, Ban, Gavel } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAsync, q } from '@/lib/hooks';
import { uploadFile, openPrivateFile } from '@/lib/storage';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { FileRef, Order, Review } from '@/lib/types';
import { Avatar, Badge, Button, Card, EmptyState, ErrorBox, Modal, PageLoader, Select, StarInput, Textarea } from '@/components/ui';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/cards';
import { cn, date, dateTime, fileSize, money, timeLeft } from '@/lib/utils';
import { ORDER_LIST_SELECT } from './Dashboard';

interface Event { id: number; event: string; note: string | null; created_at: string; actor_id: string | null }
interface Delivery { id: string; message: string; files: FileRef[]; revision_number: number; created_at: string }
interface Revision { id: string; reason: string; created_at: string }
interface Dispute { id: string; reason: string; details: string; status: string; resolution: string | null; opened_by: string; created_at: string }
interface Refund { id: string; amount: number; status: string; reference: string | null; reason: string }

function FileList({ files, bucket }: { files: FileRef[]; bucket: 'deliveries' | 'chat-files' }) {
  const toast = useToast();
  if (!files.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {files.map((f) => (
        <button key={f.path} onClick={() => openPrivateFile(bucket, f.path).catch(toast.error)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:border-brand dark:border-navy-700">
          <Download className="h-4 w-4 text-brand" /><span className="max-w-[200px] truncate">{f.name}</span><span className="text-xs text-muted">{fileSize(f.size)}</span>
        </button>
      ))}
    </div>
  );
}

export default function OrderDetail({ admin = false }: { admin?: boolean }) {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [modal, setModal] = useState<null | 'deliver' | 'revision' | 'decline' | 'dispute' | 'review' | 'cancel' | 'admin_cancel'>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [rating, setRating] = useState(5);
  const [reason, setReason] = useState('quality');
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const order = await q(supabase.from('orders').select(ORDER_LIST_SELECT).eq('id', id!).maybeSingle()) as Order | null;
    if (!order) return null;
    const [events, deliveries, revisions, disputes, review, refunds] = await Promise.all([
      q(supabase.from('order_events').select('*').eq('order_id', order.id).order('created_at')),
      q(supabase.from('deliveries').select('*').eq('order_id', order.id).order('created_at', { ascending: false })),
      q(supabase.from('revision_requests').select('*').eq('order_id', order.id).order('created_at', { ascending: false })),
      q(supabase.from('disputes').select('*').eq('order_id', order.id).order('created_at', { ascending: false })),
      q(supabase.from('reviews').select('*').eq('order_id', order.id).maybeSingle()),
      q(supabase.from('refunds').select('*').eq('order_id', order.id)),
    ]);
    return { order, events: events as Event[], deliveries: deliveries as Delivery[], revisions: revisions as Revision[], disputes: disputes as Dispute[], review: review as Review | null, refunds: refunds as Refund[] };
  }, [id]);

  // live updates when the other party acts
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`order:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, reload]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <EmptyState title="Order not found" text="It may belong to another account." />;
  const { order: o, events, deliveries, revisions, disputes, review, refunds } = data;
  const isClient = user?.id === o.client_id;
  const isFreelancer = user?.id === o.freelancer_id;
  const other = isClient ? o.freelancer : o.client;
  const tl = timeLeft(o.due_at);
  const inProgress = ['pending_acceptance', 'active', 'delivered', 'revision_requested'].includes(o.status);
  const revisionsLeft = o.revision_limit - o.revision_count;

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { await fn(); toast.success(msg); setModal(null); setText(''); setFiles([]); await reload(); }
    catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const openChat = async () => {
    try { const conv = await rpc<string>('start_conversation', { p_other: other!.id, p_order_id: o.id }); nav(`/app/messages/${conv}`); }
    catch (e) { toast.error(e); }
  };
  const deliver = () => run(async () => {
    if (text.trim().length < 5) throw new Error('Write a short delivery message');
    const refs: FileRef[] = [];
    for (const f of files) refs.push(await uploadFile('deliveries', `${o.id}/${user!.id}`, f));
    await rpc('deliver_order', { p_order: o.id, p_message: text.trim(), p_files: refs });
  }, 'Delivery sent to the client');

  return (
    <div>
      {admin && <Link to="/admin/orders" className="mb-3 inline-block text-sm text-brand">← All orders</Link>}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><OrderStatusBadge s={o.status} /><PaymentStatusBadge s={o.payment_status} /><span className="text-sm text-muted">{o.order_number}</span></div>
          <h1 className="mt-2 font-heading text-2xl font-semibold text-navy dark:text-white">{o.title}</h1>
          <p className="mt-1 text-sm text-muted">Ordered {dateTime(o.created_at)}{o.package_tier && <> · <span className="capitalize">{o.package_tier}</span> package</>}{o.offer_id && ' · Custom offer'}</p>
        </div>
        {!admin && other && (
          <div className="flex items-center gap-3">
            <Link to={isClient ? `/freelancers/${other.id}` : '#'} className="flex items-center gap-2"><Avatar url={other.avatar_url} name={other.full_name} size={36} /><span className="text-sm font-medium">{other.full_name}</span></Link>
            <Button variant="outline" size="sm" onClick={openChat}><MessageSquare className="h-4 w-4" />Message</Button>
          </div>
        )}
      </div>

      {/* Action banner */}
      {!admin && (
        <Card className="mt-6 p-5">
          {isClient && o.status === 'pending_payment' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-semibold">{o.payment_status === 'awaiting_verification' ? 'Payment submitted — awaiting verification' : o.payment_status === 'rejected' ? 'Payment could not be verified' : 'Complete payment to start this order'}</p>
                <p className="text-sm text-muted">{o.payment_status === 'awaiting_verification' ? 'We’ll notify you as soon as our team confirms it.' : 'The freelancer starts work once payment is confirmed.'}</p>
              </div>
              {o.payment_status !== 'awaiting_verification' && <>
                <Button onClick={() => nav(`/app/checkout/${o.id}`)}><CreditCard className="h-4 w-4" />Pay {money(o.total_amount)}</Button>
                <Button variant="ghost" onClick={() => setModal('cancel')}>Cancel order</Button>
              </>}
            </div>
          )}
          {isFreelancer && o.status === 'pending_payment' && <p className="text-sm text-muted">Waiting for the client to pay. You'll be notified when the order starts.</p>}
          {isFreelancer && o.status === 'pending_acceptance' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1"><p className="font-semibold">New paid order</p><p className="text-sm text-muted">Accept to start the {o.delivery_days}-day delivery countdown.</p></div>
              <Button loading={busy} onClick={() => run(() => rpc('freelancer_respond_order', { p_order: o.id, p_accept: true }), 'Order accepted — good luck!')}><CheckCircle2 className="h-4 w-4" />Accept order</Button>
              <Button variant="outline" onClick={() => setModal('decline')}>Decline</Button>
            </div>
          )}
          {isClient && o.status === 'pending_acceptance' && <p className="text-sm text-muted">Payment confirmed. Waiting for the freelancer to accept your order.</p>}
          {['active', 'revision_requested'].includes(o.status) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3">
                <Clock className={cn('h-8 w-8', tl.late ? 'text-red-500' : 'text-brand')} />
                <div><p className="font-semibold">{o.status === 'revision_requested' ? 'Revision in progress' : 'Work in progress'}</p>
                  <p className={cn('text-sm', tl.late ? 'text-red-500' : 'text-muted')}>Due {dateTime(o.due_at)} · {tl.label}</p>
                  {tl.late && <p className="mt-0.5 text-xs text-muted">{isClient ? 'Late delivery: you’ll automatically receive a credit for your next order when this order is completed.' : 'This order is late — the client receives a credit from HN when it completes. Please deliver or message the client.'}</p>}</div>
              </div>
              {isFreelancer && <Button onClick={() => setModal('deliver')}><Upload className="h-4 w-4" />Deliver work</Button>}
            </div>
          )}
          {o.status === 'delivered' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1"><p className="font-semibold">Work delivered</p>
                <p className="text-sm text-muted">{isClient ? `Review the delivery below. ${revisionsLeft > 0 ? `${revisionsLeft} revision${revisionsLeft === 1 ? '' : 's'} left.` : 'No revisions left.'} Auto-completes if there's no response.` : 'Waiting for the client to approve or request a revision.'}</p></div>
              {isClient && <>
                <Button loading={busy} onClick={() => askConfirm('Approve this delivery and complete the order? This cannot be undone.', { confirmLabel: 'Approve & complete' }).then((ok) => { if (ok) run(() => rpc('approve_delivery', { p_order: o.id }), 'Order completed'); })}><CheckCircle2 className="h-4 w-4" />Approve & complete</Button>
                <Button variant="outline" disabled={revisionsLeft <= 0} onClick={() => setModal('revision')}><RotateCcw className="h-4 w-4" />Request revision</Button>
              </>}
            </div>
          )}
          {o.status === 'completed' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1"><p className="font-semibold">Order completed {date(o.completed_at)}</p>
                <p className="text-sm text-muted">{isFreelancer ? `${money(o.freelancer_earning)} added to your pending earnings.` : review ? 'Thanks for your review!' : 'How did it go? Your review helps other clients.'}</p></div>
              {isClient && !review && <Button onClick={() => setModal('review')}><Star className="h-4 w-4" />Leave a review</Button>}
            </div>
          )}
          {o.status === 'disputed' && <p className="flex items-center gap-2 text-sm"><Gavel className="h-4 w-4 text-red-500" />A dispute is open. Our team is reviewing the order and will contact both parties.</p>}
          {['cancelled', 'refunded'].includes(o.status) && <p className="flex items-center gap-2 text-sm"><Ban className="h-4 w-4 text-muted" />Order {o.status}. {o.cancel_reason}</p>}
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {deliveries.length > 0 && (
            <Card className="p-5">
              <h2 className="font-heading font-semibold">Deliveries</h2>
              <div className="mt-3 space-y-4">
                {deliveries.map((d) => (
                  <div key={d.id} className="rounded-xl border border-slate-200 p-4 dark:border-navy-700">
                    <div className="flex items-center justify-between text-xs text-muted"><span>{d.revision_number ? `Revision ${d.revision_number}` : 'Original delivery'}</span><span>{dateTime(d.created_at)}</span></div>
                    <p className="mt-2 whitespace-pre-line text-sm">{d.message}</p>
                    <FileList files={d.files} bucket="deliveries" />
                  </div>
                ))}
              </div>
            </Card>
          )}
          {revisions.length > 0 && (
            <Card className="p-5">
              <h2 className="font-heading font-semibold">Revision requests</h2>
              {revisions.map((r) => <div key={r.id} className="mt-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-500/10"><p className="text-xs text-muted">{dateTime(r.created_at)}</p><p className="mt-1 whitespace-pre-line">{r.reason}</p></div>)}
            </Card>
          )}
          <Card className="p-5">
            <h2 className="font-heading font-semibold">Requirements</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-navy/80 dark:text-slate-300">{o.requirements || 'No requirements provided.'}</p>
          </Card>
          {disputes.length > 0 && (
            <Card className="p-5">
              <h2 className="font-heading font-semibold">Disputes</h2>
              {disputes.map((d) => (
                <div key={d.id} className="mt-3 rounded-xl border border-red-200 p-3 text-sm dark:border-red-500/30">
                  <div className="flex items-center justify-between"><Badge tone={d.status === 'resolved' || d.status === 'closed' ? 'slate' : 'red'}>{d.status}</Badge><span className="text-xs text-muted">{dateTime(d.created_at)}</span></div>
                  <p className="mt-2 font-medium capitalize">{d.reason.replace('_', ' ')}</p><p className="text-muted">{d.details}</p>
                  {d.resolution && <p className="mt-2 rounded-lg bg-slate-50 p-2 dark:bg-navy-900"><b>Resolution:</b> {d.resolution}</p>}
                </div>
              ))}
            </Card>
          )}
          {review && (
            <Card className="p-5">
              <h2 className="font-heading font-semibold">Review</h2>
              <p className="mt-2 text-amber-400">{'★'.repeat(review.rating)}<span className="text-slate-300 dark:text-navy-700">{'★'.repeat(5 - review.rating)}</span></p>
              {review.comment && <p className="mt-1 text-sm">{review.comment}</p>}
              {review.response && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-navy-900"><b>Response:</b> {review.response}</p>}
              {isFreelancer && !review.response && <Link to="/app/reviews" className="mt-2 inline-block text-sm font-medium text-brand">Respond to this review</Link>}
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="font-heading font-semibold">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Price</dt><dd>{money(o.price)}</dd></div>
              {(isClient || admin) && <div className="flex justify-between"><dt className="text-muted">Service fee</dt><dd>{Number(o.service_fee) ? money(o.service_fee) : 'Free'}</dd></div>}
              {(isClient || admin) && Number(o.discount_amount) > 0 && <div className="flex justify-between text-emerald-600"><dt>Coupon discount</dt><dd>−{money(o.discount_amount)}</dd></div>}
              {(isClient || admin) && <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold dark:border-navy-700"><dt>Total paid</dt><dd>{money(o.total_amount)}</dd></div>}
              {(isFreelancer || admin) && <div className="flex justify-between"><dt className="text-muted">Commission ({(o.commission_rate * 100).toFixed(0)}%)</dt><dd>−{money(o.commission_amount)}</dd></div>}
              {(isFreelancer || admin) && <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold dark:border-navy-700"><dt>Freelancer earns</dt><dd>{money(o.freelancer_earning)}</dd></div>}
              <div className="flex justify-between pt-2"><dt className="text-muted">Delivery</dt><dd>{o.delivery_days} days</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Revisions</dt><dd>{o.revision_count} / {o.revision_limit}</dd></div>
              {o.due_at && <div className="flex justify-between"><dt className="text-muted">Due</dt><dd>{dateTime(o.due_at)}</dd></div>}
            </dl>
            {refunds.map((r) => <p key={r.id} className="mt-3 rounded-lg bg-slate-50 p-2 text-xs dark:bg-navy-900">Refund {money(r.amount)} — <b>{r.status}</b>{r.reference && ` · Ref ${r.reference}`}</p>)}
          </Card>
          <Card className="p-5">
            <h2 className="font-heading font-semibold">Timeline</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4 dark:border-navy-700">
              {events.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                  <p className="font-medium">{e.event}</p>
                  {e.note && <p className="text-xs text-muted">{e.note}</p>}
                  <p className="text-xs text-muted">{dateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </Card>
          {!admin && inProgress && o.payment_status === 'paid' && (
            <button onClick={() => setModal('dispute')} className="flex items-center gap-2 text-sm text-muted hover:text-red-500"><AlertTriangle className="h-4 w-4" />Problem with this order? Open a dispute</button>
          )}
          {admin && !['completed', 'cancelled', 'refunded'].includes(o.status) && (
            <Button variant="danger" className="w-full" onClick={() => setModal('admin_cancel')}>Cancel order (admin)</Button>
          )}
        </aside>
      </div>

      {/* Modals */}
      <Modal open={modal === 'deliver'} onClose={() => setModal(null)} title="Deliver your work" wide>
        <div className="space-y-4">
          <Textarea label="Message to the client" rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} required />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Files (up to 10, 200 MB each)</label>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-sm text-muted hover:border-brand dark:border-navy-700">
              <Upload className="h-6 w-6" />Click to choose files
              <input type="file" multiple className="hidden" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 10))} />
            </label>
            {files.map((f, i) => (
              <div key={i} className="mt-2 flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-muted" /><span className="flex-1 truncate">{f.name}</span><span className="text-xs text-muted">{fileSize(f.size)}</span>
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove file"><X className="h-4 w-4" /></button></div>
            ))}
          </div>
          <Button size="lg" className="w-full" loading={busy} onClick={deliver}>Send delivery</Button>
        </div>
      </Modal>
      <Modal open={modal === 'revision'} onClose={() => setModal(null)} title="Request a revision">
        <div className="space-y-4">
          <p className="text-sm text-muted">{revisionsLeft} revision{revisionsLeft === 1 ? '' : 's'} left in your package. Be specific about what should change.</p>
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} />
          <Button className="w-full" loading={busy} onClick={() => run(() => rpc('request_revision', { p_order: o.id, p_reason: text.trim() }), 'Revision requested')}>Send request</Button>
        </div>
      </Modal>
      <Modal open={modal === 'decline'} onClose={() => setModal(null)} title="Decline this order">
        <div className="space-y-4">
          <p className="text-sm text-muted">The client will be refunded in full. Please explain why.</p>
          <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          <Button variant="danger" className="w-full" loading={busy} onClick={() => run(() => rpc('freelancer_respond_order', { p_order: o.id, p_accept: false, p_note: text.trim() }), 'Order declined')}>Decline order</Button>
        </div>
      </Modal>
      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel this order">
        <div className="space-y-4">
          <Textarea label="Reason (optional)" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
          <Button variant="danger" className="w-full" loading={busy} onClick={() => run(() => rpc('cancel_unpaid_order', { p_order: o.id, p_reason: text.trim() || 'Cancelled by user' }), 'Order cancelled')}>Cancel order</Button>
        </div>
      </Modal>
      <Modal open={modal === 'dispute'} onClose={() => setModal(null)} title="Open a dispute">
        <div className="space-y-4">
          <p className="text-sm text-muted">Try messaging the other party first. A dispute pauses the order while our team reviews it.</p>
          <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="not_delivered">Work not delivered</option><option value="quality">Quality doesn't match the order</option><option value="late">Late delivery</option>
            <option value="communication">No communication</option><option value="payment">Payment issue</option><option value="other">Other</option>
          </Select>
          <Textarea label="Details" rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} hint="At least 20 characters" />
          <Button variant="danger" className="w-full" loading={busy} onClick={() => run(() => rpc('open_dispute', { p_order: o.id, p_reason: reason, p_details: text.trim() }), 'Dispute opened. Our team will be in touch.')}>Open dispute</Button>
        </div>
      </Modal>
      <Modal open={modal === 'review'} onClose={() => setModal(null)} title="Rate your experience">
        <div className="space-y-4">
          <StarInput value={rating} onChange={setRating} />
          <Textarea label="Your review" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          <Button className="w-full" loading={busy} onClick={() => run(() => rpc('leave_review', { p_order: o.id, p_rating: rating, p_comment: text }), 'Thanks for your review!')}>Submit review</Button>
        </div>
      </Modal>
      <Modal open={modal === 'admin_cancel'} onClose={() => setModal(null)} title="Cancel order as admin">
        <div className="space-y-4">
          <p className="text-sm text-muted">If the order is paid, a refund record is created for processing in Payments.</p>
          <Textarea label="Reason (shown to both parties)" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          <Button variant="danger" className="w-full" loading={busy} onClick={() => run(() => rpc('admin_cancel_order', { p_order: o.id, p_reason: text.trim() }), 'Order cancelled')}>Confirm cancellation</Button>
        </div>
      </Modal>
    </div>
  );
}
