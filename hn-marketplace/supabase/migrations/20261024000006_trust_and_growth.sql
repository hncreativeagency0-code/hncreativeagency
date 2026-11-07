-- =====================================================================
-- Trust & growth upgrade (Oct 2026)
--   • Lower, transparent fees: 0% client fee up to a threshold, then a small %;
--     commission by seller level; 0% for "Founding Freelancers"
--   • Coupons (admin codes, first-order discount, late-delivery credit, referrals)
--   • Job posts ("Post a request") + proposals
--   • Freelancer ID verification requests (private document bucket)
--   • Leads: free consultation, managed projects, agency packages
--   • Gig analytics (views / contact clicks / orders)
--   • Database-level rate limiting for public forms and spam-prone actions
-- Every money-related value is still calculated inside Postgres, never in the browser.
-- =====================================================================

-- ---------- Settings ----------
insert into public.platform_settings (key, value) values
  ('client_fee_free_threshold', '5000'),                -- no client fee on orders up to this price (PKR)
  ('level_commission', '{"rising": 0.09, "top": 0.08}'), -- "new" sellers pay commission_rate
  ('seller_level_rules', '{"rising": {"orders": 5, "rating": 4.5}, "top": {"orders": 25, "rating": 4.7, "reviews": 10}}'),
  ('founding_program', '{"enabled": true, "commission_rate": 0, "months": 3, "slots": 50}'),
  ('late_compensation_rate', '0.10'),                   -- credit for the client when delivery is late
  ('referral_reward', '{"enabled": true, "amount": 500, "min_order": 2000}'),
  ('payout_sla_days', '3'),                             -- business days to pay an approved withdrawal
  ('company_info', '{"legal_name": "", "registration": "", "ntn": "", "address": ""}'),
  ('booking_url', '""'),                                -- optional external calendar link (e.g. Calendly)
  ('support_hours', '"Mon–Sat, 10am–7pm (PKT)"'),
  ('online_gateway', '{"provider": "", "label": "Card, JazzCash or Easypaisa", "methods": ["card", "jazzcash", "easypaisa"]}')
on conflict (key) do nothing;

-- Recommended client fee is 3% above the threshold (was 5% on every order)
update public.platform_settings set value = '0.03' where key = 'client_service_fee_rate' and value = '0.05'::jsonb;

create or replace function public.setting_json(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from platform_settings where key = p_key;
$$;

-- ---------- Rate limiting ----------
create table public.rate_limits (
  bucket       text not null,
  actor        text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, actor, window_start)
);
alter table public.rate_limits enable row level security;   -- no policies: functions only

create or replace function public._rate_limit(p_bucket text, p_max int, p_window_seconds int) returns void
language plpgsql security definer set search_path = public as $$
declare
  hdr jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  who text := coalesce(auth.uid()::text, split_part(coalesce(hdr ->> 'x-forwarded-for', hdr ->> 'cf-connecting-ip', ''), ',', 1), 'anon');
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  if public.is_trusted_context() and auth.uid() is null then return; end if;   -- SQL editor / service role
  insert into rate_limits (bucket, actor, window_start, hits) values (p_bucket, coalesce(nullif(who, ''), 'anon'), ws, 1)
  on conflict (bucket, actor, window_start) do update set hits = rate_limits.hits + 1
  returning hits into n;
  if n > p_max then
    raise exception 'You are doing that too often. Please wait a few minutes and try again.';
  end if;
  -- opportunistic cleanup
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '2 days'; end if;
end $$;
revoke execute on function public._rate_limit(text, int, int) from public, anon, authenticated;

create or replace function public.rate_limit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_trusted_context() and auth.uid() is null then return new; end if;
  if tg_table_name = 'messages' then
    if public.is_trusted_context() or (to_jsonb(new) ->> 'sender_id') is null then return new; end if;
  end if;
  perform public._rate_limit(tg_table_name, tg_argv[0]::int, tg_argv[1]::int);
  return new;
end $$;

create trigger contact_rate_limit before insert on public.contact_messages for each row execute function public.rate_limit_trigger('5', '600');
create trigger reports_rate_limit before insert on public.reports for each row execute function public.rate_limit_trigger('15', '3600');
create trigger messages_rate_limit before insert on public.messages for each row execute function public.rate_limit_trigger('40', '60');

-- ---------- Profiles: seller level, founding freelancer ----------
alter table public.profiles
  add column seller_level text not null default 'new' check (seller_level in ('new', 'rising', 'top')),
  add column founding_until timestamptz;

alter table public.profile_private
  add column referral_code text unique,
  add column referred_by uuid references public.profiles(id) on delete set null,
  add column whatsapp_notifications boolean not null default false;

create or replace function public._founding_slot_available() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((public.setting_json('founding_program') ->> 'enabled')::boolean, false)
     and (select count(*) from profiles where founding_until is not null)
         < coalesce((public.setting_json('founding_program') ->> 'slots')::int, 0);
$$;

create or replace function public.profiles_growth_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare months int := coalesce((public.setting_json('founding_program') ->> 'months')::int, 3);
begin
  if tg_op = 'INSERT' then
    new.seller_level := 'new';
    new.founding_until := case when new.role = 'freelancer' and public._founding_slot_available() then now() + make_interval(months => months) end;
    return new;
  end if;
  if not (public.is_trusted_context() or public.is_admin()) then
    new.seller_level := old.seller_level;
    new.founding_until := old.founding_until;
  end if;
  -- Becoming a freelancer during the founding window earns the badge
  if new.role = 'freelancer' and old.role <> 'freelancer' and old.founding_until is null and public._founding_slot_available() then
    new.founding_until := now() + make_interval(months => months);
  end if;
  return new;
end $$;
create trigger profiles_growth_guard before insert or update on public.profiles for each row execute function public.profiles_growth_guard();

-- Referral code + "referred by" (from sign-up metadata `ref`)
create or replace function public.profile_private_init() returns trigger
language plpgsql security definer set search_path = public as $$
declare ref text; referrer uuid;
begin
  new.referral_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  select u.raw_user_meta_data ->> 'ref' into ref from auth.users u where u.id = new.id;
  if ref is not null then
    select id into referrer from profile_private where referral_code = upper(trim(ref));
    if referrer is not null and referrer <> new.id then new.referred_by := referrer; end if;
  end if;
  return new;
end $$;
create trigger profile_private_init before insert on public.profile_private for each row execute function public.profile_private_init();

create or replace function public.profile_private_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_trusted_context() or public.is_admin() then return new; end if;
  new.referral_code := old.referral_code;
  new.referred_by := old.referred_by;
  return new;
end $$;
create trigger profile_private_guard before update on public.profile_private for each row execute function public.profile_private_guard();

-- Existing users get a referral code
update public.profile_private set referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) where referral_code is null;

-- ---------- Gigs: ranking boost from seller level ----------
alter table public.gigs add column seller_rank int not null default 0;
create index gigs_rank_idx on public.gigs (seller_rank desc, rating_avg desc) where status = 'published';

create or replace function public.gigs_rank_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_trusted_context() or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.seller_rank := coalesce((select case seller_level when 'top' then 2 when 'rising' then 1 else 0 end from profiles where id = new.freelancer_id), 0);
  else
    new.seller_rank := old.seller_rank;
  end if;
  return new;
end $$;
create trigger gigs_rank_guard before insert or update on public.gigs for each row execute function public.gigs_rank_guard();

create or replace function public._refresh_seller_level(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare p profiles; r jsonb := coalesce(public.setting_json('seller_level_rules'), '{}'::jsonb); lvl text := 'new';
begin
  select * into p from profiles where id = p_user;
  if not found or p.role <> 'freelancer' then return null; end if;
  if p.completed_orders >= coalesce((r #>> '{top,orders}')::int, 25) and p.rating_avg >= coalesce((r #>> '{top,rating}')::numeric, 4.7)
     and p.rating_count >= coalesce((r #>> '{top,reviews}')::int, 10) then lvl := 'top';
  elsif p.completed_orders >= coalesce((r #>> '{rising,orders}')::int, 5) and (p.rating_count = 0 or p.rating_avg >= coalesce((r #>> '{rising,rating}')::numeric, 4.5)) then lvl := 'rising';
  end if;
  if lvl is distinct from p.seller_level then
    perform public._trust(true);
    update profiles set seller_level = lvl where id = p_user;
    update gigs set seller_rank = case lvl when 'top' then 2 when 'rising' then 1 else 0 end where freelancer_id = p_user;
    if lvl <> 'new' then
      perform public._notify(p_user, 'level', 'You reached ' || initcap(lvl) || ' Seller level',
        'Your gigs rank higher and your commission is lower from your next order.', '/app');
    end if;
    perform public._trust(false);
  end if;
  return lvl;
end $$;
revoke execute on function public._refresh_seller_level(uuid) from public, anon, authenticated;

create or replace function public.reviews_level_refresh() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._refresh_seller_level(coalesce(new.freelancer_id, old.freelancer_id));
  return null;
end $$;
create trigger reviews_level_refresh after insert or update or delete on public.reviews for each row execute function public.reviews_level_refresh();

-- ---------- Coupons ----------
create table public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description      text check (char_length(description) <= 200),
  kind             text not null check (kind in ('percent', 'amount')),
  value            numeric(12,2) not null check (value > 0),
  max_discount     numeric(12,2) check (max_discount > 0),
  min_order        numeric(12,2) not null default 0 check (min_order >= 0),
  first_order_only boolean not null default false,
  owner_id         uuid references public.profiles(id) on delete cascade,   -- personal credit
  max_uses         int check (max_uses > 0),
  used_count       int not null default 0,
  expires_at       timestamptz,
  is_active        boolean not null default true,
  source           text not null default 'admin' check (source in ('admin', 'late_delivery', 'referral')),
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  check (kind <> 'percent' or value <= 90)
);
create table public.coupon_redemptions (
  coupon_id  uuid not null references public.coupons(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  order_id   uuid not null unique,
  amount     numeric(12,2) not null,
  created_at timestamptz not null default now(),
  primary key (coupon_id, user_id)
);
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
create policy coupons_read on public.coupons for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy coupons_admin on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy redemptions_read on public.coupon_redemptions for select to authenticated using (user_id = auth.uid() or public.is_admin());

alter table public.orders
  add column discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  add column coupon_id uuid references public.coupons(id) on delete set null;

-- Single source of truth for order pricing.
create or replace function public._order_pricing(p_price numeric, p_freelancer uuid, p_client uuid, p_coupon text,
  out service_fee numeric, out commission_rate numeric, out discount numeric, out coupon_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  threshold numeric := public.setting_num('client_fee_free_threshold', 5000);
  fee_rate  numeric := public.setting_num('client_service_fee_rate', 0.03);
  f profiles; fp jsonb := coalesce(public.setting_json('founding_program'), '{}'::jsonb);
  c coupons; d numeric := 0;
begin
  service_fee := case when p_price <= threshold then 0 else round(p_price * fee_rate, 2) end;
  select * into f from profiles where id = p_freelancer;
  if f.founding_until is not null and f.founding_until > now() and coalesce((fp ->> 'enabled')::boolean, false) then
    commission_rate := coalesce((fp ->> 'commission_rate')::numeric, 0);
  elsif f.seller_level in ('rising', 'top') then
    commission_rate := coalesce((public.setting_json('level_commission') ->> f.seller_level)::numeric, public.setting_num('commission_rate', 0.10));
  else
    commission_rate := public.setting_num('commission_rate', 0.10);
  end if;

  discount := 0; coupon_id := null;
  if nullif(trim(coalesce(p_coupon, '')), '') is not null then
    select * into c from coupons where code = upper(trim(p_coupon));
    if not found or not c.is_active or (c.expires_at is not null and c.expires_at < now())
       or (c.max_uses is not null and c.used_count >= c.max_uses)
       or (c.owner_id is not null and c.owner_id is distinct from p_client) then
      raise exception 'This coupon code is not valid or has expired';
    end if;
    if p_price < c.min_order then raise exception 'This coupon needs an order of at least PKR %', c.min_order; end if;
    if exists (select 1 from coupon_redemptions r where r.coupon_id = c.id and r.user_id = p_client) then
      raise exception 'You have already used this coupon';
    end if;
    if c.first_order_only and exists (select 1 from orders where client_id = p_client and payment_status in ('paid', 'refund_pending', 'refunded', 'awaiting_verification')) then
      raise exception 'This coupon is for your first order only';
    end if;
    d := case when c.kind = 'percent' then round(p_price * c.value / 100, 2) else c.value end;
    if c.max_discount is not null then d := least(d, c.max_discount); end if;
    discount := greatest(0, least(d, p_price + service_fee - 100));   -- something is always paid
    coupon_id := c.id;
  end if;
end $$;
revoke execute on function public._order_pricing(numeric, uuid, uuid, text) from public, anon, authenticated;

-- What the client will pay (shown before placing an order)
create or replace function public.preview_order_pricing(p_package uuid, p_coupon text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pk gig_packages; g gigs; pr record;
begin
  select * into pk from gig_packages where id = p_package;
  if not found then raise exception 'Package not found'; end if;
  select * into g from gigs where id = pk.gig_id;
  select * into pr from public._order_pricing(pk.price, g.freelancer_id, auth.uid(), p_coupon);
  return jsonb_build_object('price', pk.price, 'service_fee', pr.service_fee, 'discount', pr.discount,
    'total', pk.price + pr.service_fee - pr.discount, 'coupon_applied', pr.coupon_id is not null);
end $$;

create or replace function public._redeem_coupon(p_coupon uuid, p_user uuid, p_order uuid, p_amount numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_coupon is null then return; end if;
  insert into coupon_redemptions (coupon_id, user_id, order_id, amount) values (p_coupon, p_user, p_order, p_amount);
  update coupons set used_count = used_count + 1 where id = p_coupon;
end $$;
revoke execute on function public._redeem_coupon(uuid, uuid, uuid, numeric) from public, anon, authenticated;

-- ---------- Placing orders (now with coupon + new fee model) ----------
drop function if exists public.place_gig_order(uuid, text, jsonb);
create or replace function public.place_gig_order(p_package uuid, p_requirements text, p_files jsonb default '[]'::jsonb, p_coupon text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); pk gig_packages; g gigs; new_order uuid; pr record; com numeric;
begin
  select * into pk from gig_packages where id = p_package;
  if not found then raise exception 'Package not found'; end if;
  select * into g from gigs where id = pk.gig_id;
  if g.status <> 'published' then raise exception 'This gig is not available'; end if;
  if g.freelancer_id = uid then raise exception 'You cannot order your own gig'; end if;
  if not exists (select 1 from profiles where id = g.freelancer_id and status = 'active') then raise exception 'This freelancer is unavailable'; end if;
  if public.is_blocked_between(uid, g.freelancer_id) then raise exception 'Cannot order from this freelancer'; end if;
  if (select count(*) from orders where client_id = uid and status = 'pending_payment') >= 10 then
    raise exception 'You have too many unpaid orders. Pay or cancel some first.';
  end if;
  select * into pr from public._order_pricing(pk.price, g.freelancer_id, uid, p_coupon);
  com := round(pk.price * pr.commission_rate, 2);
  perform public._trust(true);
  insert into orders (client_id, freelancer_id, gig_id, package_id, title, package_tier, requirements, requirement_files,
                      price, service_fee, discount_amount, coupon_id, total_amount, commission_rate, commission_amount, freelancer_earning, delivery_days, revision_limit)
  values (uid, g.freelancer_id, g.id, pk.id, g.title, pk.tier, p_requirements, coalesce(p_files, '[]'::jsonb),
          pk.price, pr.service_fee, pr.discount, pr.coupon_id, pk.price + pr.service_fee - pr.discount, pr.commission_rate, com, pk.price - com, pk.delivery_days, pk.revisions)
  returning id into new_order;
  perform public._redeem_coupon(pr.coupon_id, uid, new_order, pr.discount);
  perform public._order_event(new_order, uid, 'Order placed', null, 'pending_payment',
    pk.name || ' package' || case when pr.discount > 0 then ' · coupon −PKR ' || pr.discount else '' end);
  perform public._trust(false);
  return new_order;
end $$;

create or replace function public.respond_custom_offer(p_offer uuid, p_action text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o custom_offers; new_order uuid; pr record; com numeric;
begin
  select * into o from custom_offers where id = p_offer for update;
  if not found then raise exception 'Offer not found'; end if;
  if p_action = 'withdraw' then
    if o.freelancer_id <> uid or o.status <> 'pending' then raise exception 'Cannot withdraw this offer'; end if;
    update custom_offers set status = 'withdrawn' where id = o.id;
    return null;
  end if;
  if o.client_id <> uid then raise exception 'Offer not found'; end if;
  if o.status <> 'pending' then raise exception 'This offer is no longer available'; end if;
  if o.expires_at < now() then update custom_offers set status = 'expired' where id = o.id; raise exception 'This offer has expired'; end if;
  if p_action = 'decline' then
    update custom_offers set status = 'declined' where id = o.id;
    perform public._trust(true);
    perform public._notify(o.freelancer_id, 'custom_offer', 'Offer declined', o.title, '/app/messages/' || o.conversation_id);
    perform public._trust(false);
    return null;
  elsif p_action <> 'accept' then raise exception 'Invalid action'; end if;

  select * into pr from public._order_pricing(o.price, o.freelancer_id, o.client_id, null);
  com := round(o.price * pr.commission_rate, 2);
  perform public._trust(true);
  insert into orders (client_id, freelancer_id, gig_id, offer_id, title, requirements, price, service_fee, total_amount,
                      commission_rate, commission_amount, freelancer_earning, delivery_days, revision_limit)
  values (o.client_id, o.freelancer_id, o.gig_id, o.id, o.title, o.description, o.price, pr.service_fee, o.price + pr.service_fee,
          pr.commission_rate, com, o.price - com, o.delivery_days, o.revisions) returning id into new_order;
  update custom_offers set status = 'accepted', order_id = new_order where id = o.id;
  update conversations set order_id = coalesce(order_id, new_order) where id = o.conversation_id;
  perform public._order_event(new_order, uid, 'Order created from custom offer', null, 'pending_payment', null);
  perform public._notify(o.freelancer_id, 'offer_accepted', 'Your offer was accepted', o.title || ' — awaiting payment', '/app/orders/' || new_order);
  insert into messages (conversation_id, sender_id, kind, body) values (o.conversation_id, null, 'system', 'Offer accepted. Order created and awaiting payment.');
  perform public._trust(false);
  return new_order;
end $$;

-- ---------- Order lifecycle side effects: levels, late-delivery credit, referrals, coupon release ----------
create or replace function public._issue_credit(p_user uuid, p_amount numeric, p_source text, p_prefix text, p_description text) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text := p_prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
begin
  if p_amount is null or p_amount < 1 then return null; end if;
  insert into coupons (code, description, kind, value, owner_id, max_uses, expires_at, source)
  values (v_code, p_description, 'amount', round(p_amount), p_user, 1, now() + interval '90 days', p_source);
  return v_code;
end $$;
revoke execute on function public._issue_credit(uuid, numeric, text, text, text) from public, anon, authenticated;

create or replace function public.orders_growth_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare rate numeric; v_code text; rr jsonb; referrer uuid; amt numeric;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public._refresh_seller_level(new.freelancer_id);

    -- Late delivery → automatic credit for the client
    rate := public.setting_num('late_compensation_rate', 0);
    if rate > 0 and new.due_at is not null and new.delivered_at is not null and new.delivered_at > new.due_at then
      v_code := public._issue_credit(new.client_id, new.price * rate, 'late_delivery', 'LATE', 'Credit for late delivery on ' || new.order_number);
      if v_code is not null then
        perform public._notify(new.client_id, 'credit', 'Sorry for the late delivery',
          'Use code ' || v_code || ' for PKR ' || round(new.price * rate) || ' off your next order.', '/app/payments');
      end if;
    end if;

    -- Referral: both people get a credit after the referred client's first completed order
    rr := coalesce(public.setting_json('referral_reward'), '{}'::jsonb);
    select referred_by into referrer from profile_private where id = new.client_id;
    amt := coalesce((rr ->> 'amount')::numeric, 0);
    if referrer is not null and coalesce((rr ->> 'enabled')::boolean, false) and amt > 0
       and new.price >= coalesce((rr ->> 'min_order')::numeric, 0)
       and not exists (select 1 from orders where client_id = new.client_id and status = 'completed' and id <> new.id)
       and not exists (select 1 from coupons where owner_id = new.client_id and source = 'referral') then
      v_code := public._issue_credit(new.client_id, amt, 'referral', 'REF', 'Referral reward');
      perform public._notify(new.client_id, 'credit', 'You earned a referral reward', 'Code ' || v_code || ' — PKR ' || amt || ' off your next order.', '/app/payments');
      v_code := public._issue_credit(referrer, amt, 'referral', 'REF', 'Referral reward');
      perform public._notify(referrer, 'credit', 'Your friend completed their first order', 'Code ' || v_code || ' — PKR ' || amt || ' off your next order.', '/app/payments');
    end if;
  end if;

  -- Coupon goes back to the client if the order is cancelled before payment
  if new.coupon_id is not null and new.status = 'cancelled' and old.status <> 'cancelled' and old.payment_status in ('unpaid', 'rejected') then
    delete from coupon_redemptions where order_id = new.id;
    update coupons set used_count = greatest(0, used_count - 1) where id = new.coupon_id;
  end if;
  return null;
end $$;
create trigger orders_growth_after after update on public.orders for each row execute function public.orders_growth_after();

-- ---------- Job posts ("Post a request") & proposals ----------
create table public.job_posts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  title           text not null check (char_length(title) between 10 and 120),
  description     text not null check (char_length(description) between 30 and 5000),
  category_id     uuid references public.categories(id) on delete set null,
  budget_min      numeric(12,2) check (budget_min >= 500),
  budget_max      numeric(12,2),
  delivery_days   int check (delivery_days between 1 and 180),
  status          text not null default 'open' check (status in ('open', 'closed', 'hired')),
  proposals_count int not null default 0,
  expires_at      timestamptz not null default now() + interval '30 days',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (budget_max is null or budget_min is null or budget_max >= budget_min)
);
create index job_posts_open_idx on public.job_posts (created_at desc) where status = 'open';
create trigger job_posts_updated before update on public.job_posts for each row execute function public.set_updated_at();

create table public.job_proposals (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.job_posts(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  cover_letter  text not null check (char_length(cover_letter) between 30 and 3000),
  price         numeric(12,2) not null check (price >= 500),
  delivery_days int not null check (delivery_days between 1 and 180),
  revisions     int not null default 1 check (revisions between 0 and 20),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  order_id      uuid references public.orders(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (job_id, freelancer_id)
);
alter table public.job_posts enable row level security;
alter table public.job_proposals enable row level security;
-- Helpers are SECURITY DEFINER so the two policies don't recurse into each other
create or replace function public.has_proposal_on(p_job uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from job_proposals where job_id = p_job and freelancer_id = auth.uid());
$$;
create or replace function public.owns_job(p_job uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from job_posts where id = p_job and client_id = auth.uid());
$$;
create policy jobs_read on public.job_posts for select using (
  (status = 'open' and expires_at > now()) or client_id = auth.uid() or public.is_admin() or public.has_proposal_on(id));
create policy proposals_read on public.job_proposals for select to authenticated using (
  freelancer_id = auth.uid() or public.is_admin() or public.owns_job(job_id));

create or replace function public.post_job(p_title text, p_description text, p_category uuid, p_budget_min numeric, p_budget_max numeric, p_delivery_days int) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); jid uuid;
begin
  if (select role from profiles where id = uid) <> 'client' then raise exception 'Only client accounts can post a request'; end if;
  perform public._rate_limit('post_job', 5, 86400);
  insert into job_posts (client_id, title, description, category_id, budget_min, budget_max, delivery_days)
  values (uid, trim(p_title), trim(p_description), p_category, p_budget_min, p_budget_max, p_delivery_days) returning id into jid;
  return jid;
end $$;

create or replace function public.close_job(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active();
begin
  update job_posts set status = 'closed' where id = p_job and (client_id = uid or public.is_admin()) and status = 'open';
  if not found then raise exception 'Request not found or already closed'; end if;
end $$;

create or replace function public.submit_proposal(p_job uuid, p_cover_letter text, p_price numeric, p_delivery_days int, p_revisions int default 1) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); j job_posts; pid uuid;
begin
  if (select role from profiles where id = uid) <> 'freelancer' then raise exception 'Only freelancers can send proposals'; end if;
  if not (select profile_completed from profiles where id = uid) then raise exception 'Complete your profile before sending proposals'; end if;
  select * into j from job_posts where id = p_job for update;
  if not found or j.status <> 'open' or j.expires_at < now() then raise exception 'This request is no longer open'; end if;
  if j.client_id = uid then raise exception 'You cannot send a proposal to yourself'; end if;
  if public.is_blocked_between(uid, j.client_id) then raise exception 'Cannot send a proposal to this client'; end if;
  perform public._rate_limit('proposal', 30, 86400);
  insert into job_proposals (job_id, freelancer_id, cover_letter, price, delivery_days, revisions)
  values (j.id, uid, trim(p_cover_letter), p_price, p_delivery_days, coalesce(p_revisions, 1)) returning id into pid;
  perform public._trust(true);
  update job_posts set proposals_count = proposals_count + 1 where id = j.id;
  perform public._notify(j.client_id, 'proposal', 'New proposal on your request', j.title, '/app/requests/' || j.id);
  perform public._trust(false);
  return pid;
exception when unique_violation then
  raise exception 'You already sent a proposal for this request';
end $$;

create or replace function public.withdraw_proposal(p_proposal uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active();
begin
  update job_proposals set status = 'withdrawn' where id = p_proposal and freelancer_id = uid and status = 'pending';
  if not found then raise exception 'Proposal not found'; end if;
end $$;

create or replace function public.respond_proposal(p_proposal uuid, p_action text, p_coupon text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); p job_proposals; j job_posts; new_order uuid; pr record; com numeric; conv uuid;
begin
  select * into p from job_proposals where id = p_proposal for update;
  if not found then raise exception 'Proposal not found'; end if;
  select * into j from job_posts where id = p.job_id for update;
  if j.client_id <> uid then raise exception 'Proposal not found'; end if;
  if p.status <> 'pending' then raise exception 'This proposal is no longer available'; end if;
  if p_action = 'decline' then
    update job_proposals set status = 'declined' where id = p.id;
    perform public._trust(true);
    perform public._notify(p.freelancer_id, 'proposal', 'Proposal not selected', j.title, '/jobs/' || j.id);
    perform public._trust(false);
    return null;
  elsif p_action <> 'accept' then raise exception 'Invalid action'; end if;
  if j.status <> 'open' then raise exception 'This request is closed'; end if;

  select * into pr from public._order_pricing(p.price, p.freelancer_id, uid, p_coupon);
  com := round(p.price * pr.commission_rate, 2);
  perform public._trust(true);
  insert into orders (client_id, freelancer_id, title, requirements, price, service_fee, discount_amount, coupon_id, total_amount,
                      commission_rate, commission_amount, freelancer_earning, delivery_days, revision_limit)
  values (uid, p.freelancer_id, j.title, j.description, p.price, pr.service_fee, pr.discount, pr.coupon_id, p.price + pr.service_fee - pr.discount,
          pr.commission_rate, com, p.price - com, p.delivery_days, p.revisions) returning id into new_order;
  perform public._redeem_coupon(pr.coupon_id, uid, new_order, pr.discount);
  update job_proposals set status = 'accepted', order_id = new_order where id = p.id;
  update job_proposals set status = 'declined' where job_id = j.id and id <> p.id and status = 'pending';
  update job_posts set status = 'hired' where id = j.id;
  perform public._order_event(new_order, uid, 'Order created from a proposal', null, 'pending_payment', null);
  perform public._notify(p.freelancer_id, 'proposal', 'Your proposal was accepted', j.title || ' — awaiting payment', '/app/orders/' || new_order);
  perform public._trust(false);
  conv := public.start_conversation(p.freelancer_id, null, new_order);
  perform public._trust(true);
  insert into messages (conversation_id, sender_id, kind, body) values (conv, null, 'system', 'Proposal accepted. Order created and awaiting payment.');
  perform public._trust(false);
  return new_order;
end $$;

-- ---------- Freelancer verification ----------
create table public.verification_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  legal_name      text not null check (char_length(legal_name) between 3 and 80),
  id_front_path   text not null,
  id_back_path    text,
  sample_links    text[] not null default '{}',
  notes           text check (char_length(notes) <= 1000),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note      text,
  reviewed_by     uuid references public.profiles(id),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create unique index verification_one_pending on public.verification_requests (user_id) where status = 'pending';
alter table public.verification_requests enable row level security;
create policy verification_read on public.verification_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('verification-docs', 'verification-docs', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "verification docs write" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "verification docs read" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create or replace function public.submit_verification(p_legal_name text, p_id_front text, p_id_back text, p_sample_links text[], p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); rid uuid;
begin
  if (select role from profiles where id = uid) <> 'freelancer' then raise exception 'Verification is for freelancer accounts'; end if;
  if (select is_verified from profiles where id = uid) then raise exception 'Your account is already verified'; end if;
  if split_part(coalesce(p_id_front, ''), '/', 1) <> uid::text or (p_id_back is not null and split_part(p_id_back, '/', 1) <> uid::text) then
    raise exception 'Upload a photo of your CNIC';
  end if;
  if coalesce(array_length(p_sample_links, 1), 0) < 1 then raise exception 'Add at least one link to your previous work'; end if;
  perform public._rate_limit('verification', 3, 86400);
  insert into verification_requests (user_id, legal_name, id_front_path, id_back_path, sample_links, notes)
  values (uid, trim(p_legal_name), p_id_front, p_id_back, p_sample_links, p_notes) returning id into rid;
  perform public._trust(true);
  perform public._notify_admins('verification', 'Verification request', trim(p_legal_name), '/admin/verification');
  perform public._trust(false);
  return rid;
exception when unique_violation then
  raise exception 'Your verification request is already being reviewed';
end $$;

create or replace function public.admin_review_verification(p_request uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin(); r verification_requests;
begin
  select * into r from verification_requests where id = p_request for update;
  if not found or r.status <> 'pending' then raise exception 'Request not found or already reviewed'; end if;
  if not p_approve and char_length(coalesce(p_note, '')) < 5 then raise exception 'Tell the freelancer what to fix'; end if;
  perform public._trust(true);
  update verification_requests set status = case when p_approve then 'approved' else 'rejected' end, admin_note = p_note, reviewed_by = uid, reviewed_at = now() where id = r.id;
  if p_approve then update profiles set is_verified = true where id = r.user_id; end if;
  perform public._notify(r.user_id, 'verification', case when p_approve then 'You are now verified' else 'Verification needs changes' end,
    coalesce(p_note, 'The verified badge now shows on your profile and gigs.'), '/app/settings');
  perform public._audit(case when p_approve then 'verification.approve' else 'verification.reject' end, 'profile', r.user_id::text, jsonb_build_object('note', p_note));
  perform public._trust(false);
end $$;

-- ---------- Leads: free consultation, managed projects, agency packages ----------
create table public.leads (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('consultation', 'managed_project', 'agency_package')),
  name           text not null check (char_length(name) between 2 and 80),
  email          text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone          text check (char_length(phone) <= 30),
  company        text check (char_length(company) <= 100),
  service        text check (char_length(service) <= 100),
  package        text check (char_length(package) <= 60),
  budget         text check (char_length(budget) <= 60),
  preferred_date date,
  preferred_time text check (char_length(preferred_time) <= 30),
  message        text check (char_length(message) <= 4000),
  status         text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  admin_note     text,
  user_id        uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy leads_insert on public.leads for insert with check (status = 'new' and admin_note is null and (user_id is null or user_id = auth.uid()));
create policy leads_admin on public.leads for select to authenticated using (public.is_admin());
create policy leads_admin_update on public.leads for update to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger leads_rate_limit before insert on public.leads for each row execute function public.rate_limit_trigger('5', '600');

create or replace function public.leads_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._notify_admins('lead', case new.kind when 'consultation' then 'Consultation booked' when 'managed_project' then 'Managed project request' else 'Agency package enquiry' end,
    new.name || coalesce(' · ' || new.package, '') || coalesce(' · ' || new.service, ''), '/admin/leads');
  return null;
end $$;
create trigger leads_notify after insert on public.leads for each row execute function public.leads_notify();

-- ---------- Gig analytics ----------
create table public.gig_stats (
  gig_id  uuid not null references public.gigs(id) on delete cascade,
  day     date not null default current_date,
  views   int not null default 0,
  clicks  int not null default 0,
  primary key (gig_id, day)
);
alter table public.gig_stats enable row level security;
create policy gig_stats_read on public.gig_stats for select to authenticated using (
  public.is_admin() or exists (select 1 from public.gigs g where g.id = gig_id and g.freelancer_id = auth.uid()));

create or replace function public.track_gig_event(p_gig uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('view', 'click') then return; end if;
  if exists (select 1 from gigs where id = p_gig and freelancer_id = auth.uid()) then return; end if;   -- own views don't count
  if not exists (select 1 from gigs where id = p_gig and status = 'published') then return; end if;
  begin
    perform public._rate_limit('gig_' || p_kind || ':' || p_gig, 3, 3600);
  exception when others then return;   -- silently ignore repeats
  end;
  insert into gig_stats (gig_id, day, views, clicks) values (p_gig, current_date, (p_kind = 'view')::int, (p_kind = 'click')::int)
  on conflict (gig_id, day) do update set views = gig_stats.views + excluded.views, clicks = gig_stats.clicks + excluded.clicks;
end $$;
grant execute on function public.track_gig_event(uuid, text) to anon, authenticated;

create or replace function public.get_gig_analytics(p_days int default 30)
returns table (gig_id uuid, title text, status public.gig_status, views bigint, clicks bigint, orders bigint, revenue numeric)
language sql stable security definer set search_path = public as $$
  select g.id, g.title, g.status,
    coalesce((select sum(s.views) from gig_stats s where s.gig_id = g.id and s.day > current_date - p_days), 0),
    coalesce((select sum(s.clicks) from gig_stats s where s.gig_id = g.id and s.day > current_date - p_days), 0),
    (select count(*) from orders o where o.gig_id = g.id and o.created_at > now() - make_interval(days => p_days) and o.payment_status <> 'unpaid'),
    coalesce((select sum(o.freelancer_earning) from orders o where o.gig_id = g.id and o.status = 'completed' and o.completed_at > now() - make_interval(days => p_days)), 0)
  from gigs g where g.freelancer_id = auth.uid()
  order by g.created_at desc;
$$;

-- ---------- Settings validation for the new keys ----------
create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin();
begin
  if p_key in ('commission_rate', 'client_service_fee_rate', 'late_compensation_rate') and ((p_value #>> '{}')::numeric < 0 or (p_value #>> '{}')::numeric > 0.5) then
    raise exception 'Rate must be between 0 and 50%%';
  end if;
  if p_key = 'client_fee_free_threshold' and (p_value #>> '{}')::numeric < 0 then raise exception 'Threshold cannot be negative'; end if;
  if p_key = 'level_commission' and exists (select 1 from jsonb_each_text(p_value) e where e.value::numeric < 0 or e.value::numeric > 0.5) then
    raise exception 'Commission must be between 0 and 50%%';
  end if;
  insert into platform_settings (key, value, updated_by, updated_at) values (p_key, p_value, uid, now())
  on conflict (key) do update set value = excluded.value, updated_by = uid, updated_at = now();
  perform public._trust(true);
  perform public._audit('setting.update', 'setting', p_key, jsonb_build_object('value', p_value));
  perform public._trust(false);
end $$;

-- A welcome coupon for first orders (admins can edit or switch it off in Admin → Coupons)
insert into public.coupons (code, description, kind, value, max_discount, min_order, first_order_only, source)
values ('WELCOME10', '10% off your first order (up to PKR 1,000)', 'percent', 10, 1000, 1000, true, 'admin')
on conflict (code) do nothing;

-- Realtime not needed for these tables. Internal helpers are not callable from the API.
revoke execute on function public._founding_slot_available() from public, anon, authenticated;
revoke execute on function public.setting_json(text) from anon;
