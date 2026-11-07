/* In-browser mock of the Supabase REST/Auth/Storage APIs, used only by the live preview build.
   It mimics the real database functions closely enough to click through every workflow,
   but nothing is persisted and there is no security — the real rules live in Postgres. */
import { seed, DEMO_USERS } from './data';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const db: Record<string, Row[]> = /* @__PURE__ */ seed();
export const demoBlobs = /* @__PURE__ */ new Map<string, string>();
export const DEMO_BASE = 'https://demo.hn-preview.local';

const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();
const later = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const P = (id: string | null | undefined) => db.profiles.find((p) => p.id === id) ?? null;
const pick = (p: Row | null) => p && { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, title: p.title, is_verified: p.is_verified, availability: p.availability, seller_level: p.seller_level, founding_until: p.founding_until, city: p.city, rating_avg: p.rating_avg, rating_count: p.rating_count, status: p.status, ...p };
const setting = (k: string) => db.platform_settings.find((s) => s.key === k)?.value;

/* ---------- auth ---------- */
const b64url = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
/* Two-step login (TOTP) — any 6-digit code is accepted in the preview. */
const factors = new Map<string, Row[]>();
const DEMO_QR = `data:image/svg+xml;utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" shape-rendering="crispEdges"><rect width="21" height="21" fill="#fff"/>' + Array.from({ length: 21 * 21 }, (_, i) => { const x = i % 21, y = Math.floor(i / 21); const finder = (a: number, b: number) => x >= a && x < a + 7 && y >= b && y < b + 7 && (x === a || x === a + 6 || y === b || y === b + 6 || (x >= a + 2 && x <= a + 4 && y >= b + 2 && y <= b + 4)); return finder(0, 0) || finder(14, 0) || finder(0, 14) || (x > 7 && y > 7 && ((x * 7 + y * 13) % 5 < 2)) ? `<rect x="${x}" y="${y}" width="1" height="1" fill="#0F172A"/>` : ''; }).join('') + '</svg>')}`;
function userObj(id: string) {
  const email = Object.values(DEMO_USERS).find((u) => u.id === id)?.email ?? `${id}@demo.hn`;
  return { id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: now(), phone: '', confirmed_at: now(), last_sign_in_at: now(),
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { full_name: P(id)?.full_name }, identities: [], factors: factors.get(id) ?? [], created_at: P(id)?.created_at ?? now(), updated_at: now() };
}
function session(id: string, aal: 'aal1' | 'aal2' = 'aal1') {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: id, role: 'authenticated', exp, aud: 'authenticated', aal, amr: [{ method: aal === 'aal2' ? 'totp' : 'password', timestamp: Math.floor(Date.now() / 1000) }], session_id: 'demo' })}.demo`;
  return { access_token: token, token_type: 'bearer', expires_in: 3600 * 24, expires_at: exp, refresh_token: `refresh-${id}`, user: userObj(id) };
}
function whoAmI(h: Headers): string | null {
  const t = h.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const parts = t.split('.');
  if (parts.length !== 3) return null;
  try { return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))).sub ?? null; } catch { return null; }
}

/* ---------- PostgREST emulation ---------- */
function expand(table: string, r: Row, depth = 0): Row {
  if (depth > 1) return r;
  switch (table) {
    case 'gigs': return { ...r, freelancer: pick(P(r.freelancer_id)), category: db.categories.find((c) => c.id === r.category_id) ?? null, gig_packages: db.gig_packages.filter((p) => p.gig_id === r.id) };
    case 'orders': return { ...r, client: pick(P(r.client_id)), freelancer: pick(P(r.freelancer_id)), reviews: db.reviews.filter((x) => x.order_id === r.id).map((x) => ({ id: x.id })) };
    case 'reviews': return { ...r, client: pick(P(r.client_id)), freelancer: pick(P(r.freelancer_id)) };
    case 'payments': return { ...r, order: db.orders.find((o) => o.id === r.order_id) ?? null, client: pick(P(r.client_id)) };
    case 'refunds': return { ...r, order: db.orders.find((o) => o.id === r.order_id) ?? null };
    case 'withdrawals': return { ...r, freelancer: pick(P(r.freelancer_id)) };
    case 'disputes': { const o = db.orders.find((x) => x.id === r.order_id); return { ...r, order: o ? expand('orders', o, depth + 1) : null }; }
    case 'reports': return { ...r, reporter: pick(P(r.reporter_id)) };
    case 'ledger_entries': return { ...r, user: pick(P(r.user_id)) };
    case 'audit_logs': return { ...r, actor: pick(P(r.actor_id)) };
    case 'favorite_gigs': { const g = db.gigs.find((x) => x.id === r.gig_id); return { ...r, gig: g ? expand('gigs', g, depth + 1) : null }; }
    case 'saved_freelancers': return { ...r, freelancer: P(r.freelancer_id) };
    case 'user_blocks': return { ...r, profile: pick(P(r.blocked_id)) };
    case 'job_posts': return { ...r, client: pick(P(r.client_id)), category: db.categories.find((c) => c.id === r.category_id) ?? null };
    case 'job_proposals': { const j = db.job_posts.find((x) => x.id === r.job_id); return { ...r, freelancer: pick(P(r.freelancer_id)), job: j ? { id: j.id, title: j.title, status: j.status } : null }; }
    case 'verification_requests': return { ...r, user: pick(P(r.user_id)) };
    default: return r;
  }
}
const get = (o: Row, path: string) => path.split('.').reduce<any>((v, k) => (v == null ? v : v[k]), o); // eslint-disable-line @typescript-eslint/no-explicit-any
const likeRe = (p: string, ci: boolean) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*')}$`, ci ? 'i' : '');

function test(v: unknown, opval: string): boolean {
  if (opval.startsWith('not.')) return !test(v, opval.slice(4));
  const i = opval.indexOf('.');
  const op = opval.slice(0, i), val = decodeURIComponent(opval.slice(i + 1));
  const num = (x: unknown) => (typeof x === 'number' ? x : Number(x));
  const cmp = (a: unknown, b: string) => (typeof a === 'number' || (!isNaN(Number(a)) && !isNaN(Number(b)) && a !== '' && a != null) ? num(a) - Number(b) : String(a ?? '').localeCompare(b));
  switch (op) {
    case 'eq': return String(v) === val;
    case 'neq': return String(v) !== val;
    case 'gt': return v != null && cmp(v, val) > 0;
    case 'gte': return v != null && cmp(v, val) >= 0;
    case 'lt': return v != null && cmp(v, val) < 0;
    case 'lte': return v != null && cmp(v, val) <= 0;
    case 'like': return likeRe(val, false).test(String(v ?? ''));
    case 'ilike': return likeRe(val, true).test(String(v ?? ''));
    case 'in': return val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v));
    case 'is': return val === 'null' ? v == null : String(v) === val;
    case 'cs': { const want = val.replace(/^\{|\}$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '').toLowerCase()); return Array.isArray(v) && want.every((w) => v.some((x: string) => String(x).toLowerCase() === w)); }
    default: return true;
  }
}
function splitTop(s: string) {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of s) { if (ch === '(' || ch === '{') depth++; if (ch === ')' || ch === '}') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; }
  if (cur) out.push(cur);
  return out;
}
function matches(row: Row, params: URLSearchParams): boolean {
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    if (key === 'or') {
      const parts = splitTop(raw.replace(/^\(|\)$/g, ''));
      if (!parts.some((p) => { const [col, ...rest] = p.split('.'); return test(get(row, col), rest.join('.')); })) return false;
      continue;
    }
    if (key === 'search' || /fts\(/.test(raw)) {
      const term = decodeURIComponent(raw.replace(/^[a-z]*fts(\([^)]*\))?\./, '')).toLowerCase().replace(/['"]/g, '');
      const hay = `${row.title ?? ''} ${row.description ?? ''} ${(row.tags ?? []).join(' ')}`.toLowerCase();
      if (!term.split(/\s+/).filter(Boolean).some((w) => hay.includes(w))) return false;
      continue;
    }
    if (!test(get(row, key), raw)) return false;
  }
  return true;
}
function sortRows(rows: Row[], order: string | null) {
  if (!order) return rows;
  const keys = order.split(',').map((o) => { const [col, dir] = o.split('.'); return { col, desc: dir === 'desc' }; });
  return [...rows].sort((a, b) => {
    for (const { col, desc } of keys) {
      const x = a[col], y = b[col];
      if (x == y) continue; // eslint-disable-line eqeqeq
      if (x == null) return 1; if (y == null) return -1;
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return desc ? -r : r;
    }
    return 0;
  });
}
const visible = (table: string, rows: Row[], me: string | null) => {
  if (table === 'messages') { const mine = new Set(db.conversation_participants.filter((p) => p.user_id === me).map((p) => p.conversation_id)); return rows.filter((m) => mine.has(m.conversation_id)); }
  const admin = P(me)?.role === 'admin';
  if (table === 'gigs') return rows.filter((g) => g.status === 'published' || g.freelancer_id === me || admin);
  if (table === 'job_posts') return rows.filter((j) => j.status === 'open' || j.client_id === me || admin || db.job_proposals.some((p) => p.job_id === j.id && p.freelancer_id === me));
  if (table === 'job_proposals') return rows.filter((p) => p.freelancer_id === me || admin || db.job_posts.some((j) => j.id === p.job_id && j.client_id === me));
  if (table === 'coupons') return rows.filter((c) => c.owner_id === me || admin);
  if (table === 'leads' || table === 'contact_messages') return admin ? rows : [];
  if (table === 'verification_requests') return rows.filter((v) => v.user_id === me || admin);
  if (table === 'profile_private') return rows.filter((v) => v.id === me || admin);
  return rows;
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const fail = (message: string, status = 400) => json({ code: 'P0001', message, details: null, hint: null }, status);

function rest(table: string, method: string, url: URL, h: Headers, body: unknown, me: string | null): Response {
  if (!db[table]) db[table] = [];
  const all = () => visible(table, db[table].map((r) => expand(table, r)), me);
  const wantsObject = (h.get('accept') ?? '').includes('vnd.pgrst.object');
  const prefer = h.get('prefer') ?? '';
  const ret = (rows: Row[], status = 200) => {
    if (wantsObject) return rows.length === 1 ? json(rows[0], status) : json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null }, 406);
    return json(prefer.includes('return=minimal') ? undefined : rows, prefer.includes('return=minimal') ? 204 : status);
  };
  if (method === 'GET' || method === 'HEAD') {
    let rows = sortRows(all().filter((r) => matches(r, url.searchParams)), url.searchParams.get('order'));
    const total = rows.length;
    const off = Number(url.searchParams.get('offset') ?? 0), lim = url.searchParams.get('limit');
    rows = rows.slice(off, lim ? off + Number(lim) : undefined);
    const range = { 'content-range': `${rows.length ? off : '*'}-${off + rows.length - 1}/${prefer.includes('count=') ? total : '*'}` };
    if (method === 'HEAD') return new Response(null, { status: 200, headers: range });
    if (wantsObject) return ret(rows);
    return json(rows, 200, range);
  }
  if (method === 'POST') {
    const items = (Array.isArray(body) ? body : [body]) as Row[];
    const conflict = url.searchParams.get('on_conflict')?.split(',');
    const out = items.map((it) => {
      if (conflict) {
        const ex = db[table].find((r) => conflict.every((c) => r[c] === it[c]));
        if (ex) { Object.assign(ex, it); return ex; }
      }
      if (table === 'favorite_gigs' && db.favorite_gigs.some((f) => f.user_id === it.user_id && f.gig_id === it.gig_id)) throw Object.assign(new Error('duplicate key value'), { dup: true });
      const row: Row = { id: table === 'ledger_entries' || table === 'audit_logs' ? Date.now() : uuid(), created_at: now(), ...defaults(table), ...it };
      db[table].push(row);
      afterInsert(table, row);
      return row;
    });
    return ret(out.map((r) => expand(table, r)), 201);
  }
  const hit = db[table].filter((r) => matches(expand(table, r), url.searchParams));
  if (method === 'PATCH') { hit.forEach((r) => Object.assign(r, body)); return ret(hit.map((r) => expand(table, r))); }
  if (method === 'DELETE') { db[table] = db[table].filter((r) => !hit.includes(r)); return ret(hit); }
  return fail('Unsupported');
}
function defaults(table: string): Row {
  if (table === 'gigs') return { status: 'draft', rating_avg: 0, rating_count: 0, orders_completed: 0, gallery: [], tags: [], faqs: [], extras: [], portfolio_ids: [], starting_price: null, min_delivery_days: null, published_at: null, rejection_reason: null };
  if (table === 'messages') return { kind: 'text', reply_to_id: null, attachment_path: null, attachment_name: null, attachment_mime: null, attachment_size: null, duration_seconds: null, offer_id: null, request_id: null, call_id: null, deleted_at: null };
  if (table === 'reports') return { status: 'open', admin_note: null, handled_by: null };
  if (table === 'notifications') return { is_read: false, emailed: false };
  if (table === 'leads') return { status: 'new', admin_note: null };
  if (table === 'coupons') return { used_count: 0, is_active: true, owner_id: null, source: 'admin', max_discount: null, max_uses: null, expires_at: null, first_order_only: false, min_order: 0 };
  if (table === 'contact_messages') return { handled: false };
  return {};
}
function afterInsert(table: string, row: Row) {
  if (table === 'messages') {
    const c = db.conversations.find((x) => x.id === row.conversation_id);
    if (c) { c.last_message_at = row.created_at; c.last_message_preview = row.kind === 'text' ? row.body : row.kind === 'image' ? '📷 Photo' : row.kind === 'voice' ? '🎤 Voice message' : `📎 ${row.attachment_name ?? 'File'}`; }
    const p = db.conversation_participants.find((x) => x.conversation_id === row.conversation_id && x.user_id === row.sender_id);
    if (p) p.last_read_at = row.created_at;
    // simulate the other person reading the message shortly after
    setTimeout(() => { db.conversation_participants.filter((x) => x.conversation_id === row.conversation_id && x.user_id !== row.sender_id).forEach((x) => (x.last_read_at = now())); }, 1500);
  }
  if (table === 'gig_packages') syncGig(row.gig_id);
}
function syncGig(gigId: string) {
  const g = db.gigs.find((x) => x.id === gigId); if (!g) return;
  const pk = db.gig_packages.filter((p) => p.gig_id === gigId);
  g.starting_price = pk.length ? Math.min(...pk.map((p) => Number(p.price))) : null;
  g.min_delivery_days = pk.length ? Math.min(...pk.map((p) => Number(p.delivery_days))) : null;
}

/* ---------- RPC (mirrors the real Postgres functions) ---------- */
const notify = (user: string, type: string, title: string, body: string | null, link: string | null) => db.notifications.push({ id: uuid(), user_id: user, type, title, body, link, is_read: false, emailed: false, created_at: now() });
const event = (order: Row, actor: string | null, ev: string, to: string | null, note: string | null = null) => db.order_events.push({ id: Date.now() + Math.random(), order_id: order.id, actor_id: actor, event: ev, from_status: order.status, to_status: to, note, created_at: now() });
const audit = (actor: string | null, action: string, entity: string, id: string, details: Row = {}) => db.audit_logs.push({ id: Date.now(), actor_id: actor, action, entity, entity_id: id, details, created_at: now() });
const O = (id: string) => { const o = db.orders.find((x) => x.id === id); if (!o) throw new Error('Order not found'); return o; };
const sysMsg = (conv: string, body: string) => db.messages.push({ id: uuid(), conversation_id: conv, sender_id: null, kind: 'system', body, ...defaults('messages'), created_at: now() });

/** Mirrors public._order_pricing(): free client fee up to the threshold, level / founding commission, coupons. */
function pricing(price: number, freelancer: string, client: string | null, code?: string | null) {
  const threshold = Number(setting('client_fee_free_threshold') ?? 5000);
  const fee = price <= threshold ? 0 : Math.round(price * Number(setting('client_service_fee_rate')) * 100) / 100;
  const f = P(freelancer); const fp = setting('founding_program') ?? {};
  const rate = f?.founding_until && new Date(f.founding_until) > new Date() && fp.enabled ? Number(fp.commission_rate ?? 0)
    : f?.seller_level === 'rising' || f?.seller_level === 'top' ? Number((setting('level_commission') ?? {})[f.seller_level] ?? setting('commission_rate')) : Number(setting('commission_rate'));
  let discount = 0; let coupon: Row | null = null;
  if (code && code.trim()) {
    const c = db.coupons.find((x) => x.code === code.trim().toUpperCase());
    if (!c || !c.is_active || (c.expires_at && c.expires_at < now()) || (c.max_uses != null && c.used_count >= c.max_uses) || (c.owner_id && c.owner_id !== client)) throw new Error('This coupon code is not valid or has expired');
    if (price < Number(c.min_order)) throw new Error(`This coupon needs an order of at least PKR ${c.min_order}`);
    if (db.coupon_redemptions.some((r) => r.coupon_id === c.id && r.user_id === client)) throw new Error('You have already used this coupon');
    if (c.first_order_only && db.orders.some((o) => o.client_id === client && ['paid', 'awaiting_verification', 'refund_pending', 'refunded'].includes(o.payment_status))) throw new Error('This coupon is for your first order only');
    discount = c.kind === 'percent' ? Math.round(price * Number(c.value)) / 100 : Number(c.value);
    if (c.max_discount) discount = Math.min(discount, Number(c.max_discount));
    discount = Math.max(0, Math.min(discount, price + fee - 100)); coupon = c;
  }
  return { fee, rate, discount, coupon };
}
function redeem(coupon: Row | null, user: string, order: Row, amount: number) {
  if (!coupon) return;
  db.coupon_redemptions.push({ coupon_id: coupon.id, user_id: user, order_id: order.id, amount, created_at: now() });
  coupon.used_count += 1;
}
function newOrder(client: string, f: string, fields: Row, code?: string | null): Row {
  const price = Number(fields.price);
  const pr = pricing(price, f, client, code); const com = Math.round(price * pr.rate);
  const o: Row = { id: uuid(), order_number: `HN-2610-${1051 + db.orders.length}`, client_id: client, freelancer_id: f, offer_id: null, requirement_files: [], currency: 'PKR',
    service_fee: pr.fee, discount_amount: pr.discount, coupon_id: pr.coupon?.id ?? null, total_amount: price + pr.fee - pr.discount, commission_rate: pr.rate, commission_amount: com, freelancer_earning: price - com, due_at: null, status: 'pending_payment',
    status_before_dispute: null, payment_status: 'unpaid', revision_count: 0, accepted_at: null, delivered_at: null, completed_at: null, cancelled_at: null, cancel_reason: null,
    deadline_reminded: false, created_at: now(), updated_at: now(), ...fields };
  db.orders.push(o);
  redeem(pr.coupon, client, o, pr.discount);
  return o;
}
function refreshLevel(id: string) {
  const p = P(id); if (!p || p.role !== 'freelancer') return;
  const r = setting('seller_level_rules') ?? { rising: { orders: 5, rating: 4.5 }, top: { orders: 25, rating: 4.7, reviews: 10 } };
  const lvl = p.completed_orders >= r.top.orders && p.rating_avg >= r.top.rating && p.rating_count >= r.top.reviews ? 'top'
    : p.completed_orders >= r.rising.orders && (p.rating_count === 0 || p.rating_avg >= r.rising.rating) ? 'rising' : 'new';
  if (lvl !== p.seller_level) {
    p.seller_level = lvl; db.gigs.filter((g) => g.freelancer_id === id).forEach((g) => (g.seller_rank = lvl === 'top' ? 2 : lvl === 'rising' ? 1 : 0));
    if (lvl !== 'new') notify(id, 'level', `You reached ${lvl === 'top' ? 'Top' : 'Rising'} Seller level`, 'Your gigs rank higher and your commission is lower from your next order.', '/app');
  }
}
function credit(user: string, amount: number, source: string, prefix: string, description: string) {
  const code = `${prefix}-${uuid().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  db.coupons.push({ id: uuid(), code, description, kind: 'amount', value: Math.round(amount), max_discount: null, min_order: 0, first_order_only: false, owner_id: user, max_uses: 1, used_count: 0, expires_at: later(90), is_active: true, source, created_at: now() });
  return code;
}
function complete(o: Row, actor: string | null, note: string) {
  event(o, actor, 'Order completed', 'completed', note);
  Object.assign(o, { status: 'completed', completed_at: now(), updated_at: now() });
  db.ledger_entries.push({ id: Date.now(), user_id: o.freelancer_id, order_id: o.id, withdrawal_id: null, kind: 'order_earning', bucket: 'pending', amount: o.freelancer_earning, description: `Earning for ${o.order_number}`, created_by: actor, created_at: now() });
  const f = P(o.freelancer_id); if (f) f.completed_orders += 1;
  notify(o.freelancer_id, 'order_completed', 'Order completed', `PKR ${o.freelancer_earning} added to pending earnings`, `/app/orders/${o.id}`);
  refreshLevel(o.freelancer_id);
  const rate = Number(setting('late_compensation_rate') ?? 0);
  if (rate > 0 && o.due_at && o.delivered_at && o.delivered_at > o.due_at) {
    const code = credit(o.client_id, Number(o.price) * rate, 'late_delivery', 'LATE', `Credit for late delivery on ${o.order_number}`);
    notify(o.client_id, 'credit', 'Sorry for the late delivery', `Use code ${code} for PKR ${Math.round(Number(o.price) * rate)} off your next order.`, '/app/settings?tab=referrals');
  }
}
function wallet(me: string) {
  const L = db.ledger_entries.filter((l) => l.user_id === me);
  const sum = (f: (l: Row) => boolean) => L.filter(f).reduce((a, l) => a + Number(l.amount), 0);
  const W = db.withdrawals.filter((w) => w.freelancer_id === me);
  return [{ pending: sum((l) => l.bucket === 'pending'), available: sum((l) => l.bucket === 'available'), total_earned: sum((l) => l.kind === 'order_earning'),
    total_commission: db.orders.filter((o) => o.freelancer_id === me && o.status === 'completed').reduce((a, o) => a + Number(o.commission_amount), 0),
    withdrawn: W.filter((w) => w.status === 'paid').reduce((a, w) => a + Number(w.amount), 0),
    in_withdrawal: W.filter((w) => ['requested', 'under_review', 'approved', 'processing'].includes(w.status)).reduce((a, w) => a + Number(w.amount), 0),
    clearance_days: setting('clearance_days'), min_withdrawal: setting('min_withdrawal') }];
}

function rpc(fn: string, a: Row, me: string | null): unknown {
  const need = () => { if (!me) throw new Error('Not signed in'); return me; };
  switch (fn) {
    case 'release_cleared_earnings': return 0;
    case 'get_wallet_summary': return wallet(need());
    case 'mark_conversation_read': { db.conversation_participants.filter((p) => p.conversation_id === a.p_conv && p.user_id === me).forEach((p) => (p.last_read_at = now())); return null; }
    case 'get_my_conversations': {
      const uid = need();
      return db.conversation_participants.filter((p) => p.user_id === uid).map((mine) => {
        const c = db.conversations.find((x) => x.id === mine.conversation_id)!;
        const other = db.conversation_participants.find((p) => p.conversation_id === c.id && p.user_id !== uid)!;
        const op = P(other.user_id)!; const priv = db.profile_private.find((x) => x.id === op.id);
        return { conversation_id: c.id, order_id: c.order_id, order_number: db.orders.find((o) => o.id === c.order_id)?.order_number ?? null, last_message_at: c.last_message_at,
          last_message_preview: c.last_message_preview, other_id: op.id, other_name: op.full_name, other_avatar: op.avatar_url, other_role: op.role,
          other_last_seen: op.show_online_status ? priv?.last_seen_at ?? null : null, i_blocked: db.user_blocks.some((b) => b.blocker_id === uid && b.blocked_id === op.id),
          unread_count: db.messages.filter((m) => m.conversation_id === c.id && m.sender_id !== uid && m.created_at > mine.last_read_at).length };
      }).sort((x, y) => y.last_message_at.localeCompare(x.last_message_at));
    }
    case 'start_conversation': {
      const uid = need();
      const found = db.conversations.find((c) => (c.order_id ?? null) === (a.p_order_id ?? null) && db.conversation_participants.some((p) => p.conversation_id === c.id && p.user_id === uid) && db.conversation_participants.some((p) => p.conversation_id === c.id && p.user_id === a.p_other));
      if (found) return found.id;
      if (a.p_other === uid) throw new Error('You cannot message yourself');
      const c = { id: uuid(), created_by: uid, order_id: a.p_order_id ?? null, gig_id: a.p_gig_id ?? null, last_message_at: now(), last_message_preview: null, created_at: now() };
      db.conversations.push(c);
      db.conversation_participants.push({ conversation_id: c.id, user_id: uid, last_read_at: now(), joined_at: now() }, { conversation_id: c.id, user_id: a.p_other, last_read_at: now(), joined_at: now() });
      return c.id;
    }
    case 'send_custom_request': {
      const uid = need(); const conv = rpc('start_conversation', { p_other: a.p_freelancer }, uid) as string;
      const r = { id: uuid(), client_id: uid, freelancer_id: a.p_freelancer, conversation_id: conv, title: a.p_title, description: a.p_description, budget: a.p_budget, deadline: a.p_deadline, attachments: a.p_attachments ?? [], status: 'open', created_at: now() };
      db.custom_requests.push(r);
      rest('messages', 'POST', new URL(DEMO_BASE), new Headers(), { conversation_id: conv, sender_id: uid, kind: 'request', body: a.p_title, request_id: r.id }, uid);
      return conv;
    }
    case 'create_custom_offer': {
      const uid = need(); const client = db.conversation_participants.find((p) => p.conversation_id === a.p_conversation && p.user_id !== uid)!.user_id;
      if (!(Number(a.p_price) >= 500)) throw new Error('Minimum price is PKR 500');
      if (String(a.p_title ?? '').length < 5 || String(a.p_description ?? '').length < 10) throw new Error('Add a title and a short scope description');
      const of = { id: uuid(), conversation_id: a.p_conversation, freelancer_id: uid, client_id: client, gig_id: null, request_id: a.p_request_id, title: a.p_title, description: a.p_description, price: Number(a.p_price), delivery_days: Number(a.p_delivery_days), revisions: Number(a.p_revisions), status: 'pending', expires_at: later(7), order_id: null, created_at: now() };
      db.custom_offers.push(of);
      const rq = db.custom_requests.find((r) => r.id === a.p_request_id); if (rq) rq.status = 'offered';
      rest('messages', 'POST', new URL(DEMO_BASE), new Headers(), { conversation_id: a.p_conversation, sender_id: uid, kind: 'offer', body: a.p_title, offer_id: of.id }, uid);
      return of.id;
    }
    case 'respond_custom_offer': {
      const uid = need(); const of = db.custom_offers.find((x) => x.id === a.p_offer)!;
      if (a.p_action !== 'accept') { of.status = a.p_action === 'withdraw' ? 'withdrawn' : 'declined'; return null; }
      if (of.client_id !== uid) throw new Error('Only the client can accept this offer');
      const o = newOrder(of.client_id, of.freelancer_id, { gig_id: of.gig_id, package_id: null, offer_id: of.id, title: of.title, package_tier: null, requirements: of.description, price: of.price, delivery_days: of.delivery_days, revision_limit: of.revisions });
      Object.assign(of, { status: 'accepted', order_id: o.id });
      event(o, uid, 'Order created from custom offer', 'pending_payment');
      sysMsg(of.conversation_id, 'Offer accepted. Order created and awaiting payment.');
      return o.id;
    }
    case 'place_gig_order': {
      const uid = need(); const pk = db.gig_packages.find((p) => p.id === a.p_package)!; const g = db.gigs.find((x) => x.id === pk.gig_id)!;
      if (P(uid)?.role === 'admin') throw new Error('Admins cannot place orders');
      if (g.freelancer_id === uid) throw new Error('You cannot order your own gig');
      const o = newOrder(uid, g.freelancer_id, { gig_id: g.id, package_id: pk.id, title: g.title, package_tier: pk.tier, requirements: a.p_requirements, price: pk.price, delivery_days: pk.delivery_days, revision_limit: pk.revisions }, a.p_coupon);
      event(o, uid, 'Order placed', 'pending_payment', `${pk.name} package${o.discount_amount ? ` · coupon −PKR ${o.discount_amount}` : ''}`);
      return o.id;
    }
    case 'preview_order_pricing': {
      const pk = db.gig_packages.find((p) => p.id === a.p_package); if (!pk) throw new Error('Package not found');
      const g = db.gigs.find((x) => x.id === pk.gig_id)!; const pr = pricing(Number(pk.price), g.freelancer_id, me, a.p_coupon);
      return { price: Number(pk.price), service_fee: pr.fee, discount: pr.discount, total: Number(pk.price) + pr.fee - pr.discount, coupon_applied: !!pr.coupon };
    }
    case 'post_job': {
      const uid = need(); if (P(uid)?.role !== 'client') throw new Error('Only client accounts can post a request');
      const j = { id: uuid(), client_id: uid, title: a.p_title, description: a.p_description, category_id: a.p_category, budget_min: a.p_budget_min, budget_max: a.p_budget_max, delivery_days: a.p_delivery_days, status: 'open', proposals_count: 0, expires_at: later(30), created_at: now(), updated_at: now() };
      db.job_posts.push(j); return j.id;
    }
    case 'close_job': { const j = db.job_posts.find((x) => x.id === a.p_job); if (!j || j.status !== 'open') throw new Error('Request not found or already closed'); j.status = 'closed'; return null; }
    case 'submit_proposal': {
      const uid = need(); if (P(uid)?.role !== 'freelancer') throw new Error('Only freelancers can send proposals');
      const j = db.job_posts.find((x) => x.id === a.p_job); if (!j || j.status !== 'open') throw new Error('This request is no longer open');
      if (db.job_proposals.some((p) => p.job_id === j.id && p.freelancer_id === uid)) throw new Error('You already sent a proposal for this request');
      const pr = { id: uuid(), job_id: j.id, freelancer_id: uid, cover_letter: a.p_cover_letter, price: Number(a.p_price), delivery_days: Number(a.p_delivery_days), revisions: Number(a.p_revisions ?? 1), status: 'pending', order_id: null, created_at: now() };
      db.job_proposals.push(pr); j.proposals_count += 1;
      notify(j.client_id, 'proposal', 'New proposal on your request', j.title, `/app/requests/${j.id}`);
      return pr.id;
    }
    case 'withdraw_proposal': { const pr = db.job_proposals.find((x) => x.id === a.p_proposal && x.freelancer_id === me); if (!pr) throw new Error('Proposal not found'); pr.status = 'withdrawn'; return null; }
    case 'respond_proposal': {
      const uid = need(); const pr = db.job_proposals.find((x) => x.id === a.p_proposal); const j = pr && db.job_posts.find((x) => x.id === pr.job_id);
      if (!pr || !j || j.client_id !== uid) throw new Error('Proposal not found');
      if (pr.status !== 'pending') throw new Error('This proposal is no longer available');
      if (a.p_action === 'decline') { pr.status = 'declined'; notify(pr.freelancer_id, 'proposal', 'Proposal not selected', j.title, `/jobs/${j.id}`); return null; }
      const o = newOrder(uid, pr.freelancer_id, { gig_id: null, package_id: null, title: j.title, package_tier: null, requirements: j.description, price: pr.price, delivery_days: pr.delivery_days, revision_limit: pr.revisions }, a.p_coupon);
      Object.assign(pr, { status: 'accepted', order_id: o.id });
      db.job_proposals.filter((x) => x.job_id === j.id && x.id !== pr.id && x.status === 'pending').forEach((x) => (x.status = 'declined'));
      j.status = 'hired';
      event(o, uid, 'Order created from a proposal', 'pending_payment');
      const conv = rpc('start_conversation', { p_other: pr.freelancer_id, p_order_id: o.id }, uid) as string;
      sysMsg(conv, 'Proposal accepted. Order created and awaiting payment.');
      notify(pr.freelancer_id, 'proposal', 'Your proposal was accepted', `${j.title} — awaiting payment`, `/app/orders/${o.id}`);
      return o.id;
    }
    case 'submit_verification': {
      const uid = need(); if (db.verification_requests.some((v) => v.user_id === uid && v.status === 'pending')) throw new Error('Your verification request is already being reviewed');
      if (!(a.p_sample_links ?? []).length) throw new Error('Add at least one link to your previous work');
      const v = { id: uuid(), user_id: uid, legal_name: a.p_legal_name, id_front_path: a.p_id_front, id_back_path: a.p_id_back, sample_links: a.p_sample_links, notes: a.p_notes, status: 'pending', admin_note: null, reviewed_by: null, reviewed_at: null, created_at: now() };
      db.verification_requests.push(v); notify('u-admin', 'verification', 'Verification request', a.p_legal_name, '/admin/verification');
      return v.id;
    }
    case 'admin_review_verification': {
      const v = db.verification_requests.find((x) => x.id === a.p_request); if (!v || v.status !== 'pending') throw new Error('Request not found or already reviewed');
      Object.assign(v, { status: a.p_approve ? 'approved' : 'rejected', admin_note: a.p_note, reviewed_by: me, reviewed_at: now() });
      if (a.p_approve) P(v.user_id)!.is_verified = true;
      notify(v.user_id, 'verification', a.p_approve ? 'You are now verified' : 'Verification needs changes', a.p_note ?? 'The verified badge now shows on your profile and gigs.', '/app/settings');
      audit(me, a.p_approve ? 'verification.approve' : 'verification.reject', 'profile', v.user_id);
      return null;
    }
    case 'track_gig_event': {
      const g = db.gigs.find((x) => x.id === a.p_gig); if (!g || g.freelancer_id === me || g.status !== 'published') return null;
      const day = now().slice(0, 10); let r = db.gig_stats.find((x) => x.gig_id === g.id && x.day === day);
      if (!r) { r = { gig_id: g.id, day, views: 0, clicks: 0 }; db.gig_stats.push(r); }
      if (a.p_kind === 'view') r.views += 1; else if (a.p_kind === 'click') r.clicks += 1;
      return null;
    }
    case 'get_gig_analytics': {
      const uid = need(); const since = new Date(Date.now() - Number(a.p_days ?? 30) * 86_400_000).toISOString();
      return db.gigs.filter((g) => g.freelancer_id === uid).map((g) => {
        const st = db.gig_stats.filter((x) => x.gig_id === g.id && x.day >= since.slice(0, 10));
        return { gig_id: g.id, title: g.title, status: g.status, views: st.reduce((s2, x) => s2 + x.views, 0), clicks: st.reduce((s2, x) => s2 + x.clicks, 0),
          orders: db.orders.filter((o) => o.gig_id === g.id && o.created_at >= since && o.payment_status !== 'unpaid').length,
          revenue: db.orders.filter((o) => o.gig_id === g.id && o.status === 'completed' && (o.completed_at ?? '') >= since).reduce((s2, o) => s2 + Number(o.freelancer_earning), 0) };
      });
    }
    case 'submit_bank_transfer': {
      const uid = need(); const o = O(a.p_order);
      const ch = a.p_channel ?? 'bank';
      if (!['bank', 'jazzcash', 'easypaisa', 'raast'].includes(ch)) throw new Error('Choose a Pakistani payment method');
      if (String(a.p_payer_reference ?? '').trim().length < 4) throw new Error('Enter the transaction ID (TID) from your receipt');
      const p = { id: uuid(), order_id: o.id, client_id: uid, amount: o.total_amount, currency: 'PKR', method: 'bank_transfer', channel: ch, provider: null, status: 'awaiting_verification', reference: `PAY-${uuid().replace(/-/g, '').slice(0, 12).toUpperCase()}`, provider_txn_id: null, payer_reference: a.p_payer_reference, payer_name: a.p_payer_name, proof_path: a.p_proof_path, submitted_at: now(), verified_by: null, verified_at: null, rejection_reason: null, created_at: now() };
      db.payments.push(p); o.payment_status = 'awaiting_verification';
      event(o, uid, `${ch[0].toUpperCase()}${ch.slice(1)} payment submitted — awaiting verification`, null, a.p_payer_reference);
      notify('u-admin', 'payment_review', 'Payment awaiting verification', `${o.order_number} · PKR ${o.total_amount}`, '/admin/payments');
      return p.id;
    }
    case 'admin_review_payment': {
      const p = db.payments.find((x) => x.id === a.p_payment)!; const o = O(p.order_id);
      if (a.p_approve) {
        const next = o.offer_id ? 'active' : 'pending_acceptance';
        event(o, me, 'Payment confirmed', next, p.reference);
        Object.assign(p, { status: 'paid', verified_by: me, verified_at: now() });
        Object.assign(o, { payment_status: 'paid', status: next, accepted_at: next === 'active' ? now() : null, due_at: next === 'active' ? later(o.delivery_days) : null });
        notify(o.client_id, 'payment', 'Payment confirmed', `${o.order_number} confirmed`, `/app/orders/${o.id}`);
        notify(o.freelancer_id, 'new_order', next === 'active' ? 'New order started' : 'New order — please accept', o.title, `/app/orders/${o.id}`);
      } else { Object.assign(p, { status: 'rejected', rejection_reason: a.p_note }); o.payment_status = 'rejected'; event(o, me, 'Payment rejected', 'pending_payment', a.p_note); }
      audit(me, a.p_approve ? 'payment.approve' : 'payment.reject', 'payment', p.id, { order_id: o.id, amount: p.amount });
      return null;
    }
    case 'freelancer_respond_order': {
      const o = O(a.p_order);
      if (a.p_accept) { event(o, me, 'Order accepted — work started', 'active', a.p_note); Object.assign(o, { status: 'active', accepted_at: now(), due_at: later(o.delivery_days) }); notify(o.client_id, 'order_accepted', 'Your order was accepted', o.title, `/app/orders/${o.id}`); }
      else {
        if (String(a.p_note ?? '').length < 5) throw new Error('Give the client a reason');
        event(o, me, 'Order declined by freelancer', 'cancelled', a.p_note);
        Object.assign(o, { status: 'cancelled', cancelled_at: now(), cancel_reason: a.p_note, payment_status: 'refund_pending' });
        db.refunds.push({ id: uuid(), order_id: o.id, payment_id: null, amount: o.total_amount, reason: `Declined by freelancer: ${a.p_note}`, status: 'pending', reference: null, processed_by: null, processed_at: null, created_at: now() });
      }
      return null;
    }
    case 'deliver_order': {
      const o = O(a.p_order);
      if (!['active', 'revision_requested'].includes(o.status)) throw new Error('This order cannot be delivered now');
      db.deliveries.push({ id: uuid(), order_id: o.id, freelancer_id: me, message: a.p_message, files: a.p_files ?? [], revision_number: o.revision_count, created_at: now() });
      event(o, me, o.revision_count ? 'Revised work delivered' : 'Work delivered', 'delivered');
      Object.assign(o, { status: 'delivered', delivered_at: now() });
      notify(o.client_id, 'delivery', 'Your order was delivered', `Review the delivery for ${o.title}`, `/app/orders/${o.id}`);
      return null;
    }
    case 'request_revision': {
      const o = O(a.p_order);
      if (o.revision_count >= o.revision_limit) throw new Error(`Revision limit reached (${o.revision_count} of ${o.revision_limit})`);
      if (String(a.p_reason ?? '').length < 10) throw new Error('Describe the changes (10+ characters)');
      db.revision_requests.push({ id: uuid(), order_id: o.id, delivery_id: null, client_id: me, reason: a.p_reason, created_at: now() });
      event(o, me, 'Revision requested', 'revision_requested', a.p_reason);
      Object.assign(o, { status: 'revision_requested', revision_count: o.revision_count + 1, due_at: later(Math.min(3, o.delivery_days)) });
      return null;
    }
    case 'approve_delivery': { complete(O(a.p_order), me, 'Approved by client'); return null; }
    case 'cancel_unpaid_order': {
      const o = O(a.p_order); event(o, me, 'Order cancelled before payment', 'cancelled', a.p_reason); Object.assign(o, { status: 'cancelled', cancelled_at: now(), cancel_reason: a.p_reason });
      if (o.coupon_id) { db.coupon_redemptions = db.coupon_redemptions.filter((r) => r.order_id !== o.id); const c = db.coupons.find((x) => x.id === o.coupon_id); if (c) c.used_count = Math.max(0, c.used_count - 1); }
      return null;
    }
    case 'open_dispute': {
      const o = O(a.p_order);
      if (String(a.p_details ?? '').length < 20) throw new Error('Describe the problem (20+ characters)');
      const d = { id: uuid(), order_id: o.id, opened_by: me, reason: a.p_reason, details: a.p_details, status: 'open', resolution: null, outcome: null, resolved_by: null, resolved_at: null, created_at: now() };
      db.disputes.push(d); event(o, me, 'Dispute opened', 'disputed', a.p_reason); Object.assign(o, { status_before_dispute: o.status, status: 'disputed' });
      return d.id;
    }
    case 'admin_resolve_dispute': {
      const d = db.disputes.find((x) => x.id === a.p_dispute)!; const o = O(d.order_id);
      if (String(a.p_resolution ?? '').length < 10) throw new Error('Write a resolution note');
      if (a.p_outcome === 'refund_client') { event(o, me, 'Dispute resolved — refund to client', 'cancelled', a.p_resolution); Object.assign(o, { status: 'cancelled', payment_status: 'refund_pending', cancelled_at: now() }); db.refunds.push({ id: uuid(), order_id: o.id, payment_id: null, amount: o.total_amount, reason: 'Dispute resolved in client’s favour', status: 'pending', reference: null, processed_by: null, processed_at: null, created_at: now() }); }
      else if (a.p_outcome === 'complete_order') complete(o, me, 'Dispute resolved — order completed');
      else { event(o, me, 'Dispute resolved — order resumed', o.status_before_dispute, a.p_resolution); o.status = o.status_before_dispute ?? 'active'; }
      Object.assign(d, { status: 'resolved', outcome: a.p_outcome, resolution: a.p_resolution, resolved_by: me, resolved_at: now() });
      audit(me, 'dispute.resolve', 'dispute', d.id, { outcome: a.p_outcome });
      return null;
    }
    case 'admin_cancel_order': { const o = O(a.p_order); event(o, me, 'Order cancelled by admin', 'cancelled', a.p_reason); Object.assign(o, { status: 'cancelled', cancel_reason: a.p_reason, cancelled_at: now(), payment_status: o.payment_status === 'paid' ? 'refund_pending' : o.payment_status }); if (o.payment_status === 'refund_pending') db.refunds.push({ id: uuid(), order_id: o.id, payment_id: null, amount: o.total_amount, reason: `Cancelled by admin: ${a.p_reason}`, status: 'pending', reference: null, processed_by: null, processed_at: null, created_at: now() }); return null; }
    case 'admin_process_refund': {
      const r = db.refunds.find((x) => x.id === a.p_refund)!; const o = O(r.order_id);
      Object.assign(r, { status: a.p_approve ? 'processed' : 'rejected', reference: a.p_reference, processed_by: me, processed_at: now() });
      if (a.p_approve) { event(o, me, 'Refund processed', 'refunded', a.p_reference); Object.assign(o, { status: 'refunded', payment_status: 'refunded' }); } else o.payment_status = 'paid';
      audit(me, a.p_approve ? 'refund.process' : 'refund.reject', 'refund', r.id, { amount: r.amount });
      return null;
    }
    case 'leave_review': {
      const o = O(a.p_order);
      if (db.reviews.some((r) => r.order_id === o.id)) throw new Error('You already reviewed this order');
      db.reviews.push({ id: uuid(), order_id: o.id, gig_id: o.gig_id, client_id: me, freelancer_id: o.freelancer_id, rating: a.p_rating, comment: a.p_comment || null, response: null, response_at: null, is_hidden: false, created_at: now() });
      const f = P(o.freelancer_id)!; const rs = db.reviews.filter((r) => r.freelancer_id === f.id && !r.is_hidden);
      f.rating_count = rs.length; f.rating_avg = Math.round((rs.reduce((x, r) => x + r.rating, 0) / rs.length) * 100) / 100;
      return null;
    }
    case 'respond_review': { const r = db.reviews.find((x) => x.id === a.p_review)!; Object.assign(r, { response: a.p_response, response_at: now() }); return null; }
    case 'publish_gig': {
      const g = db.gigs.find((x) => x.id === a.p_gig_id)!;
      if (!g.category_id) throw new Error('Choose a category'); if (!g.cover_url) throw new Error('Add a cover image');
      if (String(g.description).length < 120) throw new Error('Description must be at least 120 characters');
      g.status = setting('gig_moderation') ? 'pending_review' : 'published'; if (g.status === 'published') g.published_at = now();
      if (g.status === 'pending_review') notify('u-admin', 'gig_review', 'Gig awaiting review', g.title, '/admin/gigs');
      return g.status;
    }
    case 'admin_moderate_gig': { const g = db.gigs.find((x) => x.id === a.p_gig)!; Object.assign(g, a.p_approve ? { status: 'published', rejection_reason: null, published_at: g.published_at ?? now() } : { status: 'rejected', rejection_reason: a.p_reason }); audit(me, a.p_approve ? 'gig.approve' : 'gig.reject', 'gig', g.id); return null; }
    case 'request_withdrawal': {
      const uid = need(); const w0 = wallet(uid)[0]; const amt = Number(a.p_amount);
      if (amt < Number(setting('min_withdrawal'))) throw new Error(`Minimum withdrawal is PKR ${setting('min_withdrawal')}`);
      if (amt > w0.available) throw new Error(`Amount exceeds your available balance (PKR ${w0.available})`);
      if (db.withdrawals.some((w) => w.freelancer_id === uid && ['requested', 'under_review', 'approved', 'processing'].includes(w.status))) throw new Error('You already have a withdrawal in progress');
      const m = db.payout_methods.find((x) => x.id === a.p_method)!;
      const w = { id: uuid(), freelancer_id: uid, payout_method_id: m.id, payout_snapshot: { method: m.method, account_title: m.account_title, bank_name: m.bank_name, account_number: m.account_number }, amount: amt, status: 'requested', admin_note: null, reference: null, processed_by: null, paid_at: null, created_at: now(), updated_at: now() };
      db.withdrawals.push(w);
      db.ledger_entries.push({ id: Date.now(), user_id: uid, order_id: null, withdrawal_id: w.id, kind: 'withdrawal_hold', bucket: 'available', amount: -amt, description: 'Withdrawal request', created_by: uid, created_at: now() });
      return w.id;
    }
    case 'admin_update_withdrawal': {
      const w = db.withdrawals.find((x) => x.id === a.p_id)!;
      Object.assign(w, { status: a.p_status, admin_note: a.p_note ?? w.admin_note, reference: a.p_reference ?? w.reference, paid_at: a.p_status === 'paid' ? now() : w.paid_at, updated_at: now() });
      if (a.p_status === 'rejected') db.ledger_entries.push({ id: Date.now(), user_id: w.freelancer_id, order_id: null, withdrawal_id: w.id, kind: 'withdrawal_reversal', bucket: 'available', amount: w.amount, description: 'Withdrawal rejected — funds returned', created_by: me, created_at: now() });
      notify(w.freelancer_id, 'withdrawal', `Withdrawal ${String(a.p_status).replace('_', ' ')}`, `PKR ${w.amount}`, '/app/wallet');
      audit(me, `withdrawal.${a.p_status}`, 'withdrawal', w.id, { amount: w.amount, reference: a.p_reference });
      return null;
    }
    case 'admin_stats': {
      const by: Row = {}; db.orders.forEach((o) => (by[o.status] = (by[o.status] ?? 0) + 1));
      return { clients: db.profiles.filter((p) => p.role === 'client').length, freelancers: db.profiles.filter((p) => p.role === 'freelancer').length, suspended: db.profiles.filter((p) => p.status === 'suspended').length,
        gigs_published: db.gigs.filter((g) => g.status === 'published').length, gigs_pending: db.gigs.filter((g) => g.status === 'pending_review').length, orders_total: db.orders.length, orders_by_status: by,
        gross_paid: db.payments.filter((p) => p.status === 'paid').reduce((x, p) => x + p.amount, 0),
        commission_earned: db.orders.filter((o) => o.status === 'completed').reduce((x, o) => x + o.commission_amount + o.service_fee, 0),
        payments_pending: db.payments.filter((p) => p.status === 'awaiting_verification').length, refunds_pending: db.refunds.filter((r) => r.status === 'pending').length,
        withdrawals_open: db.withdrawals.filter((w) => ['requested', 'under_review', 'approved', 'processing'].includes(w.status)).length,
        disputes_open: db.disputes.filter((d) => ['open', 'under_review'].includes(d.status)).length, reports_open: db.reports.filter((r) => ['open', 'reviewing'].includes(r.status)).length,
        signups_30d: db.profiles.filter((p) => p.created_at > new Date(Date.now() - 30 * 86_400_000).toISOString()).length };
    }
    case 'admin_list_users': return db.profiles.filter((p) => (!a.p_role || p.role === a.p_role) && (!a.p_search || `${p.full_name} ${userObj(p.id).email}`.toLowerCase().includes(String(a.p_search).toLowerCase())))
      .map((p) => ({ id: p.id, email: userObj(p.id).email, full_name: p.full_name, role: p.role, status: p.status, is_verified: p.is_verified, created_at: p.created_at, last_seen_at: db.profile_private.find((x) => x.id === p.id)?.last_seen_at, completed_orders: p.completed_orders, email_confirmed: true }));
    case 'admin_set_user_status': { const p = P(a.p_user)!; p.status = a.p_status; audit(me, `user.${a.p_status}`, 'profile', p.id, { reason: a.p_reason }); return null; }
    case 'admin_set_verified': { const p = P(a.p_user)!; p.is_verified = a.p_verified; audit(me, a.p_verified ? 'user.verify' : 'user.unverify', 'profile', p.id); return null; }
    case 'admin_set_role': { const p = P(a.p_user)!; p.role = a.p_role; audit(me, 'user.role', 'profile', p.id, { role: a.p_role }); return null; }
    case 'admin_set_setting': { const s = db.platform_settings.find((x) => x.key === a.p_key); if (s) s.value = a.p_value; else db.platform_settings.push({ key: a.p_key, value: a.p_value }); audit(me, 'setting.update', 'setting', a.p_key, { value: a.p_value }); return null; }
    case 'admin_moderate_review': { const r = db.reviews.find((x) => x.id === a.p_review)!; r.is_hidden = a.p_hidden; return null; }
    case 'admin_update_report': { const r = db.reports.find((x) => x.id === a.p_report)!; Object.assign(r, { status: a.p_status, admin_note: a.p_note, handled_by: me }); return null; }
    case 'delete_my_message': { const m = db.messages.find((x) => x.id === a.p_message)!; Object.assign(m, { body: null, deleted_at: now(), attachment_path: null }); return null; }
    case 'start_call': throw new Error('Calls need the installed site: this preview runs in a sandbox that blocks the camera and microphone.');
    case 'update_call': return null;
    default: throw new Error(`Demo: ${fn} is not simulated`);
  }
}

/* ---------- fetch entry point ---------- */
export async function demoFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const req = input instanceof Request ? input : null;
  const url = new URL(req ? req.url : String(input));
  if (!url.href.startsWith(DEMO_BASE)) return fetch(input, init);
  const method = (init.method ?? req?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers ?? req?.headers);
  const rawBody = init.body ?? null;
  const parse = () => { try { return typeof rawBody === 'string' ? JSON.parse(rawBody) : null; } catch { return null; } };
  const me = whoAmI(headers);
  await new Promise((r) => setTimeout(r, 120)); // feel like a network
  const path = url.pathname;

  try {
    if (path.startsWith('/auth/v1/')) {
      const ep = path.slice(9);
      if (ep === 'token') {
        if (url.searchParams.get('grant_type') === 'refresh_token') { const id = (parse()?.refresh_token ?? '').replace('refresh-', ''); return P(id) ? json(session(id)) : json({ error: 'invalid_grant', error_description: 'Invalid Refresh Token' }, 400); }
        const { email } = parse() ?? {};
        const u = Object.values(DEMO_USERS).find((x) => x.email === String(email).toLowerCase().trim());
        return u ? json(session(u.id)) : json({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 400 }, 400);
      }
      if (ep === 'logout') return new Response(null, { status: 204 });
      if (ep === 'factors' && method === 'POST' && me) {
        const f = { id: uuid(), friendly_name: parse()?.friendly_name ?? 'Authenticator', factor_type: 'totp', status: 'unverified', created_at: now(), updated_at: now() };
        factors.set(me, [...(factors.get(me) ?? []), f]);
        return json({ id: f.id, type: 'totp', friendly_name: f.friendly_name, totp: { qr_code: DEMO_QR, secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/HN:demo?secret=JBSWY3DPEHPK3PXP&issuer=HN' } });
      }
      const fm = ep.match(/^factors\/([^/]+)(?:\/(challenge|verify))?$/);
      if (fm && me) {
        const list = factors.get(me) ?? []; const f = list.find((x) => x.id === fm[1]);
        if (!f) return json({ msg: 'Factor not found', code: 404 }, 404);
        if (method === 'DELETE') { factors.set(me, list.filter((x) => x !== f)); return json({ id: f.id }); }
        if (fm[2] === 'challenge') return json({ id: uuid(), type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 });
        if (fm[2] === 'verify') {
          if (!/^\d{6}$/.test(String(parse()?.code ?? ''))) return json({ msg: 'Invalid TOTP code entered', code: 422, error_code: 'mfa_verification_failed' }, 422);
          f.status = 'verified'; f.updated_at = now();
          return json(session(me, 'aal2'));
        }
      }
      if (ep === 'user') return me ? json(userObj(me)) : json({ msg: 'Unauthorized' }, 401);
      if (ep === 'signup') { const b = parse(); return json({ id: uuid(), aud: 'authenticated', role: '', email: b?.email, user_metadata: b?.data ?? {}, identities: [{}], created_at: now(), confirmation_sent_at: now() }); }
      return json({});
    }
    if (path.startsWith('/rest/v1/rpc/')) return json(rpc(path.slice(13), parse() ?? {}, me) ?? null);
    if (path.startsWith('/rest/v1/')) {
      try { return rest(path.slice(9), method, url, headers, parse(), me); }
      catch (e) { return (e as { dup?: boolean }).dup ? json({ code: '23505', message: 'duplicate key value violates unique constraint', details: null, hint: null }, 409) : fail((e as Error).message); }
    }
    if (path.startsWith('/storage/v1/object/')) {
      const rest2 = path.replace('/storage/v1/object/', '');
      if (rest2.startsWith('sign/')) return json({ signedURL: `/object/sign/${rest2.slice(5)}?token=demo` });
      const [bucket, ...p] = rest2.split('/');
      const key = decodeURIComponent(p.join('/'));
      if (rawBody instanceof Blob) demoBlobs.set(`${bucket}/${key}`, URL.createObjectURL(rawBody));
      else if (rawBody instanceof FormData) { const f = [...rawBody.values()].find((v) => v instanceof Blob) as Blob | undefined; if (f) demoBlobs.set(`${bucket}/${key}`, URL.createObjectURL(f)); }
      return json({ Key: `${bucket}/${key}`, Id: uuid() });
    }
    if (path.startsWith('/functions/v1/turn-credentials')) return json({ iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }] });
    if (path.startsWith('/functions/v1/create-payment-session')) {
      // Preview: pretend the gateway confirmed the payment instantly
      const o = O(parse()?.order_id); if (o.client_id !== me) return fail('Order not found', 404);
      const p = { id: uuid(), order_id: o.id, client_id: me, amount: o.total_amount, currency: 'PKR', method: 'online', channel: 'bank', provider: setting('online_gateway')?.provider ?? 'gateway', status: 'paid', reference: `PAY-${uuid().replace(/-/g, '').slice(0, 12).toUpperCase()}`, provider_txn_id: `TXN-${Date.now()}`, payer_reference: null, payer_name: null, proof_path: null, submitted_at: now(), verified_by: null, verified_at: now(), rejection_reason: null, created_at: now() };
      db.payments.push(p);
      const next = o.offer_id ? 'active' : 'pending_acceptance';
      event(o, me, 'Paid online — confirmed instantly', next, p.reference);
      Object.assign(o, { payment_status: 'paid', status: next, accepted_at: next === 'active' ? now() : null, due_at: next === 'active' ? later(o.delivery_days) : null });
      notify(o.freelancer_id, 'new_order', 'New order — please accept', o.title, `/app/orders/${o.id}`);
      return json({ checkout_url: `/app/orders/${o.id}?payment=success` });
    }
    return json({});
  } catch (e) {
    return fail((e as Error).message);
  }
}

/* A stand-in for Realtime channels: the preview has no websocket server. */
export function fakeChannel() {
  const ch = {
    on: () => ch, subscribe: (cb?: (s: string) => void) => { setTimeout(() => cb?.('SUBSCRIBED'), 0); return ch; },
    send: async () => 'ok', track: async () => 'ok', untrack: async () => 'ok', presenceState: () => ({}), unsubscribe: async () => 'ok',
  };
  return ch;
}
