// End-to-end database test: applies all migrations to an in-memory Postgres (PGlite) with a
// minimal Supabase auth stub, then runs the full client → freelancer → admin workflow and
// checks that abuse attempts are blocked.  Run: npm i -D @electric-sql/pglite && npm run test:db

import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const MIG = new URL('../migrations', import.meta.url).pathname;
const db = new PGlite();

const stubs = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth; create schema storage; create schema realtime;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role' $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create table realtime.messages (id bigint, topic text);
create function realtime.topic() returns text language sql as $$ select 'x' $$;
create publication supabase_realtime;
grant usage on schema public, auth, storage, realtime to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant select on all tables in schema storage to authenticated;
`;
await db.exec(stubs);
for (const f of fs.readdirSync(MIG).sort()) {
  try { await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8')); console.log('OK  ', f); }
  catch (e) { console.log('FAIL', f, e.message, e.position ?? ''); process.exit(1); }
}

const asUser = async (uid, sql, params) => {
  await db.exec(`set request.jwt.claims = '${JSON.stringify({ sub: uid, role: 'authenticated' })}'; set role authenticated`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role; reset request.jwt.claims`); }
};
const asService = async (sql, params) => {
  await db.exec(`set request.jwt.claims = '${JSON.stringify({ role: 'service_role' })}'; set role service_role`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role; reset request.jwt.claims`); }
};
const expectFail = async (label, fn) => { try { await fn(); console.log('BUG ', label, 'should have failed'); process.exitCode = 1; } catch (e) { console.log('ok  ', label, '→', e.message); } };

const C = '11111111-1111-1111-1111-111111111111', F = '22222222-2222-2222-2222-222222222222', A = '33333333-3333-3333-3333-333333333333';
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values
  ($1,'c@x.com','{"role":"client","full_name":"Client"}'), ($2,'f@x.com','{"role":"freelancer","full_name":"Free"}'), ($3,'a@x.com','{"role":"admin","full_name":"Admin"}')`, [C, F, A]);
console.log((await db.query(`select full_name, role from profiles order by full_name`)).rows);
// promote admin via direct session (like SQL editor)
await db.query(`update profiles set role='admin' where id=$1`, [A]);

// freelancer tries to self-verify (should be silently reverted)
await asUser(F, `update profiles set is_verified = true, rating_avg = 5, title = 'Brand designer' where id = $1`, [F]);
console.log('self-verify blocked:', (await db.query(`select is_verified, rating_avg, title from profiles where id=$1`, [F])).rows[0]);

// gig
const cat = (await db.query(`select id from categories where slug='graphic-design'`)).rows[0].id;
const gig = (await asUser(F, `insert into gigs (freelancer_id, category_id, title, description, cover_url, status) values ($1,$2,'I will design a modern logo for your brand',$3,'x.png','published') returning id, status`, [F, cat, 'x'.repeat(130)])).rows[0];
console.log('gig inserted as', gig.status);
const pkg = (await asUser(F, `insert into gig_packages (gig_id, tier, name, price, delivery_days, revisions) values ($1,'basic','Basic',10000,3,2) returning id`, [gig.id])).rows[0].id;
await expectFail('freelancer self-publish via update', () => asUser(F, `update gigs set status='published' where id=$1`, [gig.id]));
console.log('publish_gig →', (await asUser(F, `select publish_gig($1) s`, [gig.id])).rows[0].s);
await expectFail('order unpublished gig', () => asUser(C, `select place_gig_order($1,'reqs')`, [pkg]));
await asUser(A, `select admin_moderate_gig($1, true, null)`, [gig.id]);
console.log('gig after approve:', (await db.query(`select status, starting_price from gigs where id=$1`, [gig.id])).rows[0]);

// order
await expectFail('freelancer orders own gig', () => asUser(F, `select place_gig_order($1,'x')`, [pkg]));
const order = (await asUser(C, `select place_gig_order($1,'Please make it purple') id`, [pkg])).rows[0].id;
console.log('order:', (await db.query(`select order_number, status, price, service_fee, total_amount, commission_amount, freelancer_earning from orders where id=$1`, [order])).rows[0]);
await expectFail('client direct-updates order', async () => { const r = await asUser(C, `update orders set status='completed' where id=$1 returning id`, [order]); if (!r.rows.length) throw new Error('0 rows (RLS)'); });
await expectFail('deliver before payment', () => asUser(F, `select deliver_order($1,'here you go','[]')`, [order]));
await expectFail('bad proof path', () => asUser(C, `select submit_bank_transfer($1,'Client','TXN123',$2)`, [order, 'other/path.png']));
await asUser(C, `select submit_bank_transfer($1,'Client','TXN123',$2)`, [order, `${order}/${C}/proof.png`]);
await expectFail('double submit', () => asUser(C, `select submit_bank_transfer($1,'Client','TXN124',$2)`, [order, `${order}/${C}/proof.png`]));
const pay = (await db.query(`select id from payments where order_id=$1`, [order])).rows[0].id;
await expectFail('non-admin approves payment', () => asUser(C, `select admin_review_payment($1,true)`, [pay]));
await expectFail('client calls internal _confirm_payment', () => asUser(C, `select _confirm_payment($1,$2,null)`, [pay, C]));
await asUser(A, `select admin_review_payment($1,true)`, [pay]);
await expectFail('approve twice', () => asUser(A, `select admin_review_payment($1,true)`, [pay]));
console.log('after payment:', (await db.query(`select status, payment_status from orders where id=$1`, [order])).rows[0]);
await asUser(F, `select freelancer_respond_order($1,true,null)`, [order]);
await asUser(F, `select deliver_order($1,'First version attached', $2)`, [order, JSON.stringify([{ path: `${order}/${F}/logo.zip`, name: 'logo.zip' }])]);
await asUser(C, `select request_revision($1,'Make the icon a bit bigger please')`, [order]);
await asUser(F, `select deliver_order($1,'Updated version', '[]')`, [order]);
await asUser(C, `select request_revision($1,'One more small tweak please')`, [order]);
await asUser(F, `select deliver_order($1,'Final version', '[]')`, [order]);
await expectFail('third revision over limit', () => asUser(C, `select request_revision($1,'And another tweak please')`, [order]));
await expectFail('freelancer approves own delivery', () => asUser(F, `select approve_delivery($1)`, [order]));
await asUser(C, `select approve_delivery($1)`, [order]);
await expectFail('approve twice', () => asUser(C, `select approve_delivery($1)`, [order]));
console.log('wallet:', (await asUser(F, `select * from get_wallet_summary()`)).rows[0]);
await asUser(C, `select leave_review($1,5,'Great work')`, [order]);
await expectFail('duplicate review', () => asUser(C, `select leave_review($1,4,'again')`, [order]));
console.log('rating:', (await db.query(`select rating_avg, rating_count, completed_orders from profiles where id=$1`, [F])).rows[0]);

// earnings clearance & withdrawal
await expectFail('withdraw before clearance', async () => {
  const m = (await asUser(F, `insert into payout_methods (user_id, method, account_title, account_number) values ($1,'jazzcash','Free Lancer','03001234567') returning id`, [F])).rows[0].id;
  await asUser(F, `select request_withdrawal(5000,$1)`, [m]);
});
await db.query(`update orders set completed_at = now() - interval '8 days' where id=$1`, [order]);
console.log('released:', (await asUser(F, `select release_cleared_earnings() n`)).rows[0].n, (await asUser(F, `select release_cleared_earnings() n`)).rows[0].n);
const method = (await db.query(`select id from payout_methods where user_id=$1`, [F])).rows[0].id;
await expectFail('withdraw more than balance', () => asUser(F, `select request_withdrawal(99999,$1)`, [method]));
const w = (await asUser(F, `select request_withdrawal(5000,$1) id`, [method])).rows[0].id;
await expectFail('second open withdrawal', () => asUser(F, `select request_withdrawal(1000,$1)`, [method]));
await expectFail('ledger tamper', () => asUser(F, `update ledger_entries set amount = 999999 where user_id=$1`, [F]).then(r => { if (!r.affectedRows) throw new Error('0 rows (RLS)'); }));
await expectFail('skip to paid', () => asUser(A, `select admin_update_withdrawal($1,'paid',null,'REF1')`, [w]));
await asUser(A, `select admin_update_withdrawal($1,'approved')`, [w]);
await asUser(A, `select admin_update_withdrawal($1,'processing')`, [w]);
await asUser(A, `select admin_update_withdrawal($1,'paid',null,'JC-998877')`, [w]);
console.log('wallet after payout:', (await asUser(F, `select pending, available, withdrawn from get_wallet_summary()`)).rows[0]);

// messaging + offers + dispute/refund
const conv = (await asUser(C, `select start_conversation($1) id`, [F])).rows[0].id;
await asUser(C, `insert into messages (conversation_id, sender_id, body) values ($1,$2,'Hi!')`, [conv, C]);
await expectFail('spoof sender', () => asUser(C, `insert into messages (conversation_id, sender_id, body) values ($1,$2,'fake')`, [conv, F]));
await expectFail('client inserts fake offer msg', () => asUser(C, `insert into messages (conversation_id, sender_id, kind, body) values ($1,$2,'system','You won')`, [conv, C]));
console.log('convs:', (await asUser(F, `select other_name, unread_count, last_message_preview from get_my_conversations()`)).rows);
const offer = (await asUser(F, `select create_custom_offer($1,'Full brand kit','Logo, colors, typography and social templates',20000,5,1) id`, [conv])).rows[0].id;
const o2 = (await asUser(C, `select respond_custom_offer($1,'accept') id`, [offer])).rows[0].id;
await expectFail('JazzCash while disabled', () => asUser(C, `select submit_bank_transfer($1,'Client','TID555',$2,'jazzcash')`, [o2, `${o2}/${C}/p.png`]));
await expectFail('non-Pakistani channel', () => asUser(C, `select submit_bank_transfer($1,'Client','TID555',$2,'paypal')`, [o2, `${o2}/${C}/p.png`]));
await asUser(A, `select admin_set_setting('payment_channels', jsonb_set((select value from platform_settings where key='payment_channels'), '{jazzcash,enabled}', 'true'))`);
await asUser(C, `select submit_bank_transfer($1,'Client','TID555',$2,'jazzcash')`, [o2, `${o2}/${C}/p.png`]);
console.log('jazzcash payment:', (await db.query(`select channel, currency, status from payments where order_id=$1`, [o2])).rows[0]);
await expectFail('non-PKR order', () => db.query(`update orders set currency='USD' where id=$1`, [o2]));
await asUser(A, `select admin_review_payment((select id from payments where order_id=$1),true)`, [o2]);
console.log('offer order:', (await db.query(`select status, due_at is not null due from orders where id=$1`, [o2])).rows[0]);
const d = (await asUser(C, `select open_dispute($1,'late','The freelancer is not responding to any messages') id`, [o2])).rows[0].id;
await asUser(A, `select admin_resolve_dispute($1,'refund_client','Refunding the client in full as no work was delivered')`, [d]);
const rf = (await db.query(`select id from refunds where order_id=$1`, [o2])).rows[0].id;
await asUser(A, `select admin_process_refund($1,true,'IBFT-123')`, [rf]);
console.log('refunded order:', (await db.query(`select status, payment_status from orders where id=$1`, [o2])).rows[0]);

// calls
const call = (await asUser(C, `select start_call($1,'video') id`, [conv])).rows[0].id;
await expectFail('caller accepts own call', () => asUser(C, `select update_call($1,'accepted')`, [call]));
await asUser(F, `select update_call($1,'accepted')`, [call]);
await asUser(C, `select update_call($1,'ended')`, [call]);
console.log('call msg:', (await db.query(`select body from messages where call_id=$1`, [call])).rows);
console.log('admin stats:', (await asUser(A, `select admin_stats() s`)).rows[0].s);
await expectFail('client admin_stats', () => asUser(C, `select admin_stats()`));
console.log('notifications for F:', (await db.query(`select type, title from notifications where user_id=$1 order by created_at`, [F])).rows.map(r => r.type).join(','));
console.log('audit:', (await db.query(`select action from audit_logs order by id`)).rows.map(r => r.action).join(','));

// ======================================================================
// Trust & growth upgrade: fees, coupons, job posts, verification, leads,
// analytics, seller levels, late-delivery credit, referrals, rate limits
// ======================================================================
console.log('\n--- growth ---');
const asAnon = async (sql, params) => {
  await db.exec(`set request.jwt.claims = '${JSON.stringify({ role: 'anon' })}'; set role anon`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role; reset request.jwt.claims`); }
};
const assert = (label, cond, extra = '') => { if (cond) console.log('ok  ', label, extra); else { console.log('BUG ', label, extra); process.exitCode = 1; } };

const first = (await db.query(`select price, service_fee, commission_rate, freelancer_earning from orders where id=$1`, [order])).rows[0];
assert('PKR 10,000 order → 3% client fee', Number(first.service_fee) === 300, JSON.stringify(first));
assert('founding freelancer pays 0% commission', Number(first.commission_rate) === 0);

// guards on the new profile/gig columns
await asUser(F, `update profiles set seller_level='top', founding_until=now()+interval '10 years' where id=$1`, [F]);
const fg = (await db.query(`select seller_level, founding_until < now() + interval '1 year' ok from profiles where id=$1`, [F])).rows[0];
assert('freelancer cannot self-promote level/founding', fg.seller_level !== 'top' && fg.ok, JSON.stringify(fg));
await asUser(F, `update gigs set seller_rank = 99 where id=$1`, [gig.id]);
assert('freelancer cannot boost own ranking', (await db.query(`select seller_rank from gigs where id=$1`, [gig.id])).rows[0].seller_rank < 99);
const refC = (await asUser(C, `select referral_code from profile_private where id=$1`, [C])).rows[0].referral_code;
await asUser(C, `update profile_private set referral_code='HACKED' where id=$1`, [C]);
assert('referral code cannot be changed', (await db.query(`select referral_code from profile_private where id=$1`, [C])).rows[0].referral_code === refC);

// referred client + small package
const C2 = '44444444-4444-4444-4444-444444444444', F2 = '55555555-5555-5555-5555-555555555555';
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1,'c2@x.com',$3), ($2,'f2@x.com','{"role":"freelancer","full_name":"Free Two"}')`,
  [C2, F2, JSON.stringify({ role: 'client', full_name: 'Client Two', ref: refC.toLowerCase() })]);
assert('referral captured at sign-up', (await db.query(`select referred_by from profile_private where id=$1`, [C2])).rows[0].referred_by === C);
const small = (await asUser(F, `insert into gig_packages (gig_id, tier, name, price, delivery_days, revisions) values ($1,'standard','Small',3000,2,1) returning id`, [gig.id])).rows[0].id;
const prev = (await asUser(C2, `select preview_order_pricing($1,'welcome10') p`, [small])).rows[0].p;
assert('preview: no fee ≤ PKR 5,000 and 10% welcome discount', prev.service_fee == 0 && prev.discount == 300 && prev.total == 2700, JSON.stringify(prev));
await expectFail('unknown coupon', () => asUser(C2, `select place_gig_order($1,'Need a small logo please','[]','NOPE')`, [small]));
const tiny = (await asUser(F, `insert into gig_packages (gig_id, tier, name, price, delivery_days, revisions) values ($1,'premium','Tiny',500,1,0) returning id`, [gig.id])).rows[0].id;
await expectFail('coupon below minimum order', () => asUser(C2, `select preview_order_pricing($1,'WELCOME10')`, [tiny]));
const co = (await asUser(C2, `select place_gig_order($1,'Need a small logo please','[]','WELCOME10') id`, [small])).rows[0].id;
assert('order total includes discount', Number((await db.query(`select total_amount from orders where id=$1`, [co])).rows[0].total_amount) === 2700);
await expectFail('coupon used twice', () => asUser(C2, `select place_gig_order($1,'Again please, same thing','[]','WELCOME10')`, [small]));
await asUser(C2, `select cancel_unpaid_order($1,'Changed my mind')`, [co]);
const co2 = (await asUser(C2, `select place_gig_order($1,'Need a small logo please','[]','WELCOME10') id`, [small])).rows[0].id;
assert('coupon released after unpaid cancellation', !!co2);
await expectFail('first-order coupon for returning client', () => asUser(C, `select preview_order_pricing($1,'WELCOME10')`, [small]));

// late delivery + referral rewards on completion
await asUser(C2, `select submit_bank_transfer($1,'Client Two','TXN-C2-1',$2)`, [co2, `${co2}/${C2}/p.png`]);
await asUser(A, `select admin_review_payment((select id from payments where order_id=$1),true)`, [co2]);
await asUser(F, `select freelancer_respond_order($1,true,null)`, [co2]);
await db.query(`update orders set due_at = now() - interval '1 day' where id=$1`, [co2]);
await asUser(F, `select deliver_order($1,'Here is your logo', '[]')`, [co2]);
await asUser(C2, `select approve_delivery($1)`, [co2]);
const credits = (await db.query(`select owner_id, source, value from coupons where owner_id in ($1,$2) order by source`, [C, C2])).rows;
assert('late-delivery credit issued (10%)', credits.some((c) => c.owner_id === C2 && c.source === 'late_delivery' && Number(c.value) === 300), JSON.stringify(credits));
assert('referral credit for both people', credits.filter((c) => c.source === 'referral').length === 2);
assert('client sees own credits only', (await asUser(C2, `select count(*)::int n from coupons`)).rows[0].n === 2);

// job posts & proposals
await expectFail('freelancer posts a request', () => asUser(F, `select post_job('Need a logo for my cafe','A warm, friendly logo for a small cafe in Lahore please',null,3000,6000,5)`));
const job = (await asUser(C, `select post_job('Need a logo for my cafe','A warm, friendly logo for a small cafe in Lahore please',$1,3000,6000,5) id`, [cat])).rows[0].id;
assert('anyone can read open requests', (await asAnon(`select count(*)::int n from job_posts`)).rows[0].n === 1);
await db.query(`update profiles set profile_completed = true where id in ($1,$2)`, [F, F2]);
const prop = (await asUser(F, `select submit_proposal($1,'I have designed 40+ cafe logos. I will send 3 concepts in 4 days.',5000,4,2) id`, [job])).rows[0].id;
await asUser(F2, `select submit_proposal($1,'Experienced designer, happy to help with your cafe branding.',4500,5,1)`, [job]);
await expectFail('duplicate proposal', () => asUser(F, `select submit_proposal($1,'Second try at the same request, please choose me.',4000,4,2)`, [job]));
assert('freelancer sees only own proposal', (await asUser(F2, `select count(*)::int n from job_proposals`)).rows[0].n === 1);
assert('client sees all proposals', (await asUser(C, `select count(*)::int n from job_proposals`)).rows[0].n === 2);
await expectFail('freelancer accepts own proposal', () => asUser(F, `select respond_proposal($1,'accept')`, [prop]));
const jo = (await asUser(C, `select respond_proposal($1,'accept') id`, [prop])).rows[0].id;
const jr = (await db.query(`select o.price, o.status, j.status js, (select count(*) from job_proposals where job_id=j.id and status='declined')::int declined
  from orders o, job_posts j where o.id=$1 and j.id=$2`, [jo, job])).rows[0];
assert('accepted proposal → order, request hired, others declined', jr.status === 'pending_payment' && jr.js === 'hired' && jr.declined === 1, JSON.stringify(jr));
assert('order chat created', (await db.query(`select count(*)::int n from conversations where order_id=$1`, [jo])).rows[0].n === 1);

// verification
await expectFail('verification with someone else\'s file', () => asUser(F2, `select submit_verification('Free Two',$1,null,array['https://behance.net/x'])`, [`${F}/cnic.png`]));
const vr = (await asUser(F2, `select submit_verification('Free Two',$1,null,array['https://behance.net/x']) id`, [`${F2}/cnic.png`])).rows[0].id;
await expectFail('second pending request', () => asUser(F2, `select submit_verification('Free Two',$1,null,array['https://behance.net/x'])`, [`${F2}/cnic2.png`]));
await expectFail('non-admin approves verification', () => asUser(F2, `select admin_review_verification($1,true)`, [vr]));
await asUser(A, `select admin_review_verification($1,true,null)`, [vr]);
assert('verified badge granted', (await db.query(`select is_verified from profiles where id=$1`, [F2])).rows[0].is_verified === true);

// leads (public form) + rate limiting
await asAnon(`insert into leads (kind, name, email, service, preferred_date) values ('consultation','Ali','ali@x.com','Website', current_date + 2)`);
assert('anon cannot read leads', (await asAnon(`select count(*)::int n from leads`)).rows[0].n === 0);
assert('admin reads leads', (await asUser(A, `select count(*)::int n from leads`)).rows[0].n === 1);
await expectFail('lead with admin note', () => asAnon(`insert into leads (kind, name, email, admin_note) values ('consultation','Ali','ali@x.com','vip')`));
for (let i = 0; i < 4; i++) await asAnon(`insert into contact_messages (name, email, message) values ('Spam','s@x.com','hello hello hello')`);
await asAnon(`insert into contact_messages (name, email, message) values ('Spam','s@x.com','hello hello hello')`);
await expectFail('contact form flood (6th in 10 min)', () => asAnon(`insert into contact_messages (name, email, message) values ('Spam','s@x.com','hello hello hello')`));

// analytics
await asAnon(`select track_gig_event($1,'view')`, [gig.id]);
await asUser(C, `select track_gig_event($1,'view')`, [gig.id]);
await asUser(C, `select track_gig_event($1,'click')`, [gig.id]);
await asUser(F, `select track_gig_event($1,'view')`, [gig.id]);   // own view ignored
const an = (await asUser(F, `select views, clicks, orders from get_gig_analytics(30) where gig_id=$1`, [gig.id])).rows[0];
assert('gig analytics', Number(an.views) === 2 && Number(an.clicks) === 1 && Number(an.orders) >= 1, JSON.stringify(an));
assert('analytics private to owner', (await asUser(C, `select count(*)::int n from gig_stats`)).rows[0].n === 0);

// seller levels
await db.query(`update profiles set completed_orders = 5 where id=$1`, [F]);
await asUser(C, `select leave_review($1,5,'Lovely work again')`, [co2]).catch(() => null);
await db.query(`select _refresh_seller_level($1)`, [F]);
assert('rising seller after 5 orders', (await db.query(`select seller_level from profiles where id=$1`, [F])).rows[0].seller_level === 'rising');
assert('gig rank follows level', (await db.query(`select seller_rank from gigs where id=$1`, [gig.id])).rows[0].seller_rank === 1);
await expectFail('settings: commission above 50%', () => asUser(A, `select admin_set_setting('level_commission','{"rising":0.9}')`));
console.log('growth checks done');
