// Starts an instant online payment (card / JazzCash / Easypaisa) for an order and returns the
// gateway's hosted-checkout URL. The client is redirected there; the gateway then calls
// `payment-webhook`, which is the ONLY place an order is marked paid.
//
// Status: framework complete. Before enabling "Pay instantly" in Admin → Settings:
//   1. Get a Pakistani merchant account (e.g. Safepay or PayFast) — confirm current availability,
//      fees and marketplace terms with the provider in writing.
//   2. Replace `createCheckout()` below with the provider's DOCUMENTED "create checkout/session" call.
//   3. Test in the provider's sandbox end-to-end (success, failure, cancel, duplicate webhook).
//
// Secrets (supabase secrets set …): PAYMENT_PROVIDER, PAYMENT_API_KEY, PAYMENT_API_BASE, SITE_URL
// Deploy: supabase functions deploy create-payment-session
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** PROVIDER ADAPTER — replace with the gateway's documented API. Must return the hosted checkout URL. */
async function createCheckout(o: { id: string; order_number: string; total_amount: number; title: string }, customerEmail: string | undefined, site: string): Promise<{ url: string; sessionId: string }> {
  const base = Deno.env.get('PAYMENT_API_BASE'); const key = Deno.env.get('PAYMENT_API_KEY');
  if (!base || !key) throw new Error('Payment gateway is not configured');
  // ADAPT: endpoint path, field names and amount format (some gateways expect paisa, i.e. amount × 100).
  const r = await fetch(`${base}/checkout/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: o.total_amount, currency: 'PKR', reference: o.order_number, description: o.title.slice(0, 120),
      customer_email: customerEmail, metadata: { order_id: o.id },
      success_url: `${site}/app/orders/${o.id}?payment=success`, cancel_url: `${site}/app/checkout/${o.id}?payment=cancelled`,
    }),
  });
  if (!r.ok) { console.error('Gateway error', r.status, await r.text()); throw new Error('Gateway rejected the request'); }
  const j = await r.json() as { url?: string; checkout_url?: string; id?: string; tracker?: string };
  const url = j.url ?? j.checkout_url; const sessionId = j.id ?? j.tracker ?? '';
  if (!url) throw new Error('Gateway did not return a checkout URL');
  return { url, sessionId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return reply({ error: 'Please sign in again.' }, 401);

  let orderId = '';
  try { orderId = String((await req.json()).order_id ?? ''); } catch { /* empty */ }
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return reply({ error: 'Order not found' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: enabled } = await admin.from('platform_settings').select('value').eq('key', 'online_payments_enabled').maybeSingle();
  if (enabled?.value !== true) return reply({ error: 'Online payment is not available right now.' }, 409);

  const { data: o } = await admin.from('orders').select('id,order_number,client_id,total_amount,title,status,payment_status,currency').eq('id', orderId).maybeSingle();
  if (!o || o.client_id !== user.id) return reply({ error: 'Order not found' }, 404);
  if (o.status !== 'pending_payment' || !['unpaid', 'rejected'].includes(o.payment_status) || o.currency !== 'PKR') return reply({ error: 'This order does not need payment' }, 409);

  try {
    const site = (Deno.env.get('SITE_URL') ?? new URL(req.headers.get('origin') ?? 'https://hncreativeagency.pages.dev').origin).replace(/\/$/, '');
    const { url, sessionId } = await createCheckout({ ...o, total_amount: Number(o.total_amount) }, user.email, site);
    await admin.from('payment_events').insert({ provider: Deno.env.get('PAYMENT_PROVIDER') ?? 'gateway', event_type: 'checkout.created',
      idempotency_key: `session:${sessionId || crypto.randomUUID()}`, signature_valid: true, payload: { order_id: o.id, amount: o.total_amount, session_id: sessionId } });
    return reply({ checkout_url: url });
  } catch (e) {
    console.error(e);
    return reply({ error: 'Online payment is not available right now. Please use bank transfer, JazzCash or Easypaisa.' }, 503);
  }
});
