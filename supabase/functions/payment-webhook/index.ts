// Payment gateway webhook — the ONLY path by which an online payment can mark an order paid.
//
// Status: framework complete, provider adapter NOT yet configured. Online payments stay
// disabled (platform setting `online_payments_enabled = false`) until you:
//   1. sign a merchant agreement with a Pakistani gateway (e.g. Safepay or PayFast — see docs/PAYMENTS.md),
//   2. replace `verifySignature` and `confirmWithProvider` below with that provider's DOCUMENTED scheme,
//   3. test end-to-end in the provider's sandbox.
//
// Security properties already enforced here and in the database:
//   - raw-body HMAC signature check with a constant-time comparison
//   - idempotency: every event is stored once (payment_events.idempotency_key is unique)
//   - server-side re-verification of the transaction with the provider before crediting
//   - amount must equal the order total (checked again inside provider_payment_succeeded)
//   - provider_payment_succeeded() can only be executed by the service role
//
// Secrets: PAYMENT_PROVIDER, PAYMENT_WEBHOOK_SECRET, PAYMENT_API_KEY, PAYMENT_API_BASE
import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const PROVIDER = Deno.env.get('PAYMENT_PROVIDER') ?? 'unconfigured';

async function hmacHex(secret: string, body: string, algo: 'SHA-256' | 'SHA-512' = 'SHA-256') {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: algo }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** PROVIDER ADAPTER — replace with the gateway's documented signature scheme (header name, algorithm, payload). */
async function verifySignature(req: Request, raw: string): Promise<boolean> {
  const secret = Deno.env.get('PAYMENT_WEBHOOK_SECRET');
  const sent = req.headers.get('x-signature') ?? '';
  if (!secret || !sent) return false;
  return safeEqual(sent.toLowerCase(), await hmacHex(secret, raw));
}

/** Normalised event extracted from the provider payload. ADAPT field names to the provider. */
function parseEvent(p: Record<string, unknown>) {
  return {
    eventId: String(p.event_id ?? p.id ?? ''),
    type: String(p.type ?? p.event ?? ''),
    orderId: String(p.order_id ?? (p.metadata as Record<string, unknown> | undefined)?.order_id ?? ''),
    txnId: String(p.transaction_id ?? p.tracker ?? ''),
    amount: Number(p.amount ?? 0),
    succeeded: ['payment.succeeded', 'PAYMENT_SUCCESS', 'paid'].includes(String(p.type ?? p.event ?? p.status ?? '')),
  };
}

/** Never trust the webhook alone: ask the provider API whether this transaction is really paid. */
async function confirmWithProvider(txnId: string, expectedAmount: number): Promise<boolean> {
  const base = Deno.env.get('PAYMENT_API_BASE'); const key = Deno.env.get('PAYMENT_API_KEY');
  if (!base || !key) throw new Error('Payment provider API is not configured');
  // ADAPT: call the provider's documented "get transaction/order status" endpoint.
  const r = await fetch(`${base}/transactions/${encodeURIComponent(txnId)}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) return false;
  const t = await r.json() as { status?: string; amount?: number };
  return ['paid', 'succeeded', 'PAID', 'SUCCESS'].includes(String(t.status)) && Number(t.amount) === expectedAmount;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw); } catch { return new Response('Bad payload', { status: 400 }); }

  const valid = await verifySignature(req, raw);
  const ev = parseEvent(payload);
  const idem = `${PROVIDER}:${ev.eventId || (await hmacHex('idem', raw))}`;

  const { error: insErr } = await admin.from('payment_events').insert({ provider: PROVIDER, event_type: ev.type || 'unknown', idempotency_key: idem, signature_valid: valid, payload });
  if (insErr?.code === '23505') return new Response('duplicate', { status: 200 });     // already processed
  if (!valid) return new Response('Invalid signature', { status: 401 });
  if (!ev.succeeded) return new Response('ignored', { status: 200 });
  if (!ev.orderId || !ev.txnId) return new Response('Missing order or transaction id', { status: 400 });

  const { data: order } = await admin.from('orders').select('id,total_amount,status').eq('id', ev.orderId).maybeSingle();
  if (!order) return new Response('Unknown order', { status: 404 });

  try {
    if (!(await confirmWithProvider(ev.txnId, Number(order.total_amount)))) return new Response('Not confirmed by provider', { status: 409 });
    const { error } = await admin.rpc('provider_payment_succeeded', { p_order: order.id, p_provider: PROVIDER, p_provider_txn: ev.txnId, p_amount: Number(order.total_amount) });
    if (error) { console.error(error); return new Response(error.message, { status: 409 }); }
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('Provider check failed', { status: 503 }); // provider will retry
  }
});
