-- =====================================================================
-- Business logic. Every state change for orders, payments, earnings,
-- withdrawals and moderation goes through these SECURITY DEFINER
-- functions, which validate the caller and the transition server-side.
-- Users have NO direct insert/update rights on those tables (see RLS).
-- =====================================================================

-- ---------- Context helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

-- Trusted = inside one of our definer functions, service role (edge functions), or a direct DB session (SQL editor / cron)
create or replace function public.is_trusted_context() returns boolean
language sql stable as $$
  select coalesce(current_setting('hn.trusted', true), '') = 'on'
      or coalesce(auth.role(), '') = 'service_role'
      or coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') = '';
$$;

create or replace function public._trust(p_on boolean) returns void
language sql as $$ select set_config('hn.trusted', case when p_on then 'on' else 'off' end, true); $$;

create or replace function public._require_active() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = v and status = 'active') then
    raise exception 'Your account is suspended. Contact support.' using errcode = '42501';
  end if;
  return v;
end $$;

create or replace function public._require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return auth.uid();
end $$;

create or replace function public.setting_num(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from platform_settings where key = p_key), p_default);
$$;

create or replace function public.setting_bool(p_key text, p_default boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from platform_settings where key = p_key), p_default);
$$;

create or replace function public._notify(p_user uuid, p_type text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link);
$$;

create or replace function public._notify_admins(p_type text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link)
  select id, p_type, p_title, p_body, p_link from profiles where role = 'admin' and status = 'active';
$$;

create or replace function public._order_event(p_order uuid, p_actor uuid, p_event text,
  p_from public.order_status, p_to public.order_status, p_note text) returns void
language sql security definer set search_path = public as $$
  insert into order_events (order_id, actor_id, event, from_status, to_status, note)
  values (p_order, p_actor, p_event, p_from, p_to, p_note);
$$;

create or replace function public._audit(p_action text, p_entity text, p_entity_id text, p_details jsonb) returns void
language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, entity, entity_id, details) values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Internal helpers must never be callable from the API
revoke execute on function public._trust(boolean), public._notify(uuid, text, text, text, text),
  public._notify_admins(text, text, text, text),
  public._order_event(uuid, uuid, text, public.order_status, public.order_status, text),
  public._audit(text, text, text, jsonb) from public, anon, authenticated;

-- ---------- New user bootstrap ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.user_role;
begin
  -- Admin can never be self-assigned at sign-up
  r := case when new.raw_user_meta_data->>'role' = 'freelancer' then 'freelancer'::public.user_role else 'client'::public.user_role end;
  insert into public.profiles (id, role, full_name)
  values (new.id, r, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 80));
  insert into public.profile_private (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- Column guards ----------
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_trusted_context() or public.is_admin() then return new; end if;
  if new.role is distinct from old.role and (new.role = 'admin' or old.role = 'admin') then
    raise exception 'Role change not allowed';
  end if;
  new.id := old.id;
  new.is_verified := old.is_verified;
  new.status := old.status;
  new.rating_avg := old.rating_avg;
  new.rating_count := old.rating_count;
  new.completed_orders := old.completed_orders;
  new.created_at := old.created_at;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

create or replace function public.gigs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_trusted_context() or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'draft'; new.rating_avg := 0; new.rating_count := 0; new.orders_completed := 0; new.published_at := null;
    return new;
  end if;
  new.freelancer_id := old.freelancer_id;
  new.rating_avg := old.rating_avg; new.rating_count := old.rating_count; new.orders_completed := old.orders_completed;
  new.published_at := old.published_at; new.rejection_reason := old.rejection_reason;
  new.starting_price := old.starting_price; new.min_delivery_days := old.min_delivery_days;
  if new.status is distinct from old.status and new.status not in ('draft', 'unpublished') then
    raise exception 'Use publish_gig() to submit a gig for publication';
  end if;
  -- Content edits on a live gig go back to review when moderation is on
  if old.status = 'published' and new.status = 'published' and public.setting_bool('gig_moderation', true)
     and (new.title, new.description, new.cover_url, new.gallery, new.tags)
         is distinct from (old.title, old.description, old.cover_url, old.gallery, old.tags) then
    new.status := 'pending_review';
  end if;
  return new;
end $$;
create trigger gigs_guard before insert or update on public.gigs for each row execute function public.gigs_guard();

create or replace function public.gig_packages_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare g uuid := coalesce(new.gig_id, old.gig_id);
begin
  perform public._trust(true);
  update gigs set
    starting_price = (select min(price) from gig_packages where gig_id = g),
    min_delivery_days = (select min(delivery_days) from gig_packages where gig_id = g)
  where id = g;
  perform public._trust(false);
  return null;
end $$;
create trigger gig_packages_sync after insert or update or delete on public.gig_packages
  for each row execute function public.gig_packages_sync();

-- ---------- Gig publishing ----------
create or replace function public.publish_gig(p_gig_id uuid) returns public.gig_status
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); g gigs; new_status public.gig_status;
begin
  select * into g from gigs where id = p_gig_id for update;
  if not found or g.freelancer_id <> uid then raise exception 'Gig not found'; end if;
  if not exists (select 1 from profiles where id = uid and role = 'freelancer') then raise exception 'Only freelancers can publish gigs'; end if;
  if g.category_id is null then raise exception 'Choose a category'; end if;
  if char_length(g.description) < 120 then raise exception 'Description must be at least 120 characters'; end if;
  if g.cover_url is null then raise exception 'Add a cover image'; end if;
  if not exists (select 1 from gig_packages where gig_id = g.id and tier = 'basic') then raise exception 'Add at least a Basic package'; end if;
  new_status := case when public.setting_bool('gig_moderation', true) then 'pending_review' else 'published' end;
  perform public._trust(true);
  update gigs set status = new_status, rejection_reason = null,
    published_at = case when new_status = 'published' then coalesce(published_at, now()) else published_at end
  where id = g.id;
  if new_status = 'pending_review' then
    perform public._notify_admins('gig_review', 'Gig awaiting review', g.title, '/admin/gigs');
  end if;
  perform public._trust(false);
  return new_status;
end $$;

-- ---------- Conversations ----------
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public.is_conversation_participant(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_participants where conversation_id = p_conv and user_id = auth.uid());
$$;

create or replace function public.is_order_party(p_order uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orders where id = p_order and auth.uid() in (client_id, freelancer_id));
$$;

create or replace function public.start_conversation(p_other uuid, p_gig_id uuid default null, p_order_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); conv uuid; me profiles; other profiles;
begin
  if p_other = uid then raise exception 'You cannot message yourself'; end if;
  select * into me from profiles where id = uid;
  select * into other from profiles where id = p_other;
  if not found or other.status <> 'active' then raise exception 'User unavailable'; end if;
  if public.is_blocked_between(uid, p_other) then raise exception 'Messaging is blocked between these accounts'; end if;
  if me.role = 'client' and other.role = 'client' then raise exception 'Clients can only message freelancers'; end if;
  if p_order_id is not null and not exists (select 1 from orders where id = p_order_id and uid in (client_id, freelancer_id) and p_other in (client_id, freelancer_id)) then
    raise exception 'Order not found';
  end if;

  select c.id into conv from conversations c
  where c.order_id is not distinct from p_order_id
    and exists (select 1 from conversation_participants where conversation_id = c.id and user_id = uid)
    and exists (select 1 from conversation_participants where conversation_id = c.id and user_id = p_other)
  limit 1;
  if conv is not null then return conv; end if;

  insert into conversations (created_by, gig_id, order_id) values (uid, p_gig_id, p_order_id) returning id into conv;
  insert into conversation_participants (conversation_id, user_id) values (conv, uid), (conv, p_other);
  return conv;
end $$;

create or replace function public.get_my_conversations() returns table (
  conversation_id uuid, order_id uuid, order_number text, last_message_at timestamptz, last_message_preview text,
  other_id uuid, other_name text, other_avatar text, other_role public.user_role, other_last_seen timestamptz,
  i_blocked boolean, unread_count bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.order_id, o.order_number, c.last_message_at, c.last_message_preview,
         p.id, p.full_name, p.avatar_url, p.role,
         case when p.show_online_status then (select pp.last_seen_at from profile_private pp where pp.id = p.id) end,
         exists (select 1 from user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.id),
         (select count(*) from messages m where m.conversation_id = c.id and m.created_at > me.last_read_at and m.sender_id is distinct from auth.uid())
  from conversation_participants me
  join conversations c on c.id = me.conversation_id
  join conversation_participants op on op.conversation_id = c.id and op.user_id <> me.user_id
  join profiles p on p.id = op.user_id
  left join orders o on o.id = c.order_id
  where me.user_id = auth.uid()
  order by c.last_message_at desc;
$$;

create or replace function public.mark_conversation_read(p_conv uuid) returns void
language sql security definer set search_path = public as $$
  update conversation_participants set last_read_at = now() where conversation_id = p_conv and user_id = auth.uid();
$$;

create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  if public.is_trusted_context() then return new; end if;
  if new.sender_id is distinct from auth.uid() then raise exception 'Invalid sender'; end if;
  perform public._require_active();
  if new.kind not in ('text', 'image', 'file', 'voice') then raise exception 'Invalid message type'; end if;
  if new.attachment_path is not null and split_part(new.attachment_path, '/', 1) <> new.conversation_id::text then
    raise exception 'Invalid attachment path';
  end if;
  if new.attachment_path is not null and split_part(new.attachment_path, '/', 2) <> auth.uid()::text then
    raise exception 'Invalid attachment path';
  end if;
  select user_id into other from conversation_participants where conversation_id = new.conversation_id and user_id <> auth.uid() limit 1;
  if other is not null and public.is_blocked_between(auth.uid(), other) then raise exception 'Messaging is blocked'; end if;
  new.offer_id := null; new.request_id := null; new.call_id := null; new.deleted_at := null; new.created_at := now();
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare preview text; sender_name text; r record;
begin
  preview := case new.kind
    when 'text' then left(new.body, 120) when 'image' then '📷 Photo' when 'file' then '📎 ' || coalesce(new.attachment_name, 'File')
    when 'voice' then '🎤 Voice message' when 'offer' then '💼 Custom offer' when 'request' then '📝 Project request'
    when 'call' then coalesce(new.body, 'Call') else left(coalesce(new.body, ''), 120) end;
  update conversations set last_message_at = new.created_at, last_message_preview = preview where id = new.conversation_id;
  if new.sender_id is not null then
    update conversation_participants set last_read_at = new.created_at where conversation_id = new.conversation_id and user_id = new.sender_id;
    select full_name into sender_name from profiles where id = new.sender_id;
    for r in select user_id from conversation_participants where conversation_id = new.conversation_id and user_id <> new.sender_id loop
      -- one unread "new message" notification per conversation at a time
      if not exists (select 1 from notifications where user_id = r.user_id and type = 'message' and not is_read
                     and link = '/app/messages/' || new.conversation_id) then
        perform public._notify(r.user_id, 'message', 'New message from ' || coalesce(nullif(sender_name, ''), 'a user'), preview,
                               '/app/messages/' || new.conversation_id);
      end if;
    end loop;
  end if;
  return null;
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.messages_after_insert();

create or replace function public.delete_my_message(p_message uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update messages set body = null, deleted_at = now(), attachment_path = null
  where id = p_message and sender_id = auth.uid() and deleted_at is null and kind in ('text', 'image', 'file', 'voice');
  if not found then raise exception 'Message not found'; end if;
end $$;

-- ---------- Custom requests & offers ----------
create or replace function public.send_custom_request(p_freelancer uuid, p_title text, p_description text,
  p_budget numeric, p_deadline date, p_attachments jsonb default '[]'::jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); conv uuid; req uuid;
begin
  if not exists (select 1 from profiles where id = p_freelancer and role = 'freelancer' and status = 'active') then
    raise exception 'Freelancer not found';
  end if;
  if p_deadline is not null and p_deadline < current_date then raise exception 'Deadline must be in the future'; end if;
  conv := public.start_conversation(p_freelancer, null, null);
  insert into custom_requests (client_id, freelancer_id, conversation_id, title, description, budget, deadline, attachments)
  values (uid, p_freelancer, conv, p_title, p_description, p_budget, p_deadline, coalesce(p_attachments, '[]'::jsonb)) returning id into req;
  perform public._trust(true);
  insert into messages (conversation_id, sender_id, kind, body, request_id) values (conv, uid, 'request', p_title, req);
  perform public._notify(p_freelancer, 'custom_request', 'New project request', p_title, '/app/messages/' || conv);
  perform public._trust(false);
  return conv;
end $$;

create or replace function public.create_custom_offer(p_conversation uuid, p_title text, p_description text,
  p_price numeric, p_delivery_days int, p_revisions int, p_request_id uuid default null, p_gig_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); client uuid; offer uuid;
begin
  if not exists (select 1 from profiles where id = uid and role = 'freelancer') then raise exception 'Only freelancers can send offers'; end if;
  if not exists (select 1 from conversation_participants where conversation_id = p_conversation and user_id = uid) then raise exception 'Conversation not found'; end if;
  select user_id into client from conversation_participants where conversation_id = p_conversation and user_id <> uid limit 1;
  if client is null or public.is_blocked_between(uid, client) then raise exception 'Cannot send offer'; end if;
  if p_gig_id is not null and not exists (select 1 from gigs where id = p_gig_id and freelancer_id = uid) then raise exception 'Gig not found'; end if;
  insert into custom_offers (conversation_id, freelancer_id, client_id, gig_id, request_id, title, description, price, delivery_days, revisions)
  values (p_conversation, uid, client, p_gig_id, p_request_id, p_title, p_description, p_price, p_delivery_days, p_revisions) returning id into offer;
  if p_request_id is not null then update custom_requests set status = 'offered' where id = p_request_id and freelancer_id = uid; end if;
  perform public._trust(true);
  insert into messages (conversation_id, sender_id, kind, body, offer_id) values (p_conversation, uid, 'offer', p_title, offer);
  perform public._notify(client, 'custom_offer', 'You received a custom offer', p_title, '/app/messages/' || p_conversation);
  perform public._trust(false);
  return offer;
end $$;

create or replace function public.respond_custom_offer(p_offer uuid, p_action text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o custom_offers; new_order uuid;
  fee_rate numeric := public.setting_num('client_service_fee_rate', 0.05);
  com_rate numeric := public.setting_num('commission_rate', 0.10);
  fee numeric; com numeric;
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

  fee := round(o.price * fee_rate, 2); com := round(o.price * com_rate, 2);
  perform public._trust(true);
  insert into orders (client_id, freelancer_id, gig_id, offer_id, title, requirements, price, service_fee, total_amount,
                      commission_rate, commission_amount, freelancer_earning, delivery_days, revision_limit)
  values (o.client_id, o.freelancer_id, o.gig_id, o.id, o.title, o.description, o.price, fee, o.price + fee,
          com_rate, com, o.price - com, o.delivery_days, o.revisions) returning id into new_order;
  update custom_offers set status = 'accepted', order_id = new_order where id = o.id;
  update conversations set order_id = coalesce(order_id, new_order) where id = o.conversation_id;
  perform public._order_event(new_order, uid, 'Order created from custom offer', null, 'pending_payment', null);
  perform public._notify(o.freelancer_id, 'offer_accepted', 'Your offer was accepted', o.title || ' — awaiting payment', '/app/orders/' || new_order);
  insert into messages (conversation_id, sender_id, kind, body) values (o.conversation_id, null, 'system', 'Offer accepted. Order created and awaiting payment.');
  perform public._trust(false);
  return new_order;
end $$;

-- ---------- Placing a gig order ----------
create or replace function public.place_gig_order(p_package uuid, p_requirements text, p_files jsonb default '[]'::jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); pk gig_packages; g gigs; new_order uuid;
  fee_rate numeric := public.setting_num('client_service_fee_rate', 0.05);
  com_rate numeric := public.setting_num('commission_rate', 0.10);
  fee numeric; com numeric;
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
  fee := round(pk.price * fee_rate, 2); com := round(pk.price * com_rate, 2);
  perform public._trust(true);
  insert into orders (client_id, freelancer_id, gig_id, package_id, title, package_tier, requirements, requirement_files,
                      price, service_fee, total_amount, commission_rate, commission_amount, freelancer_earning, delivery_days, revision_limit)
  values (uid, g.freelancer_id, g.id, pk.id, g.title, pk.tier, p_requirements, coalesce(p_files, '[]'::jsonb),
          pk.price, fee, pk.price + fee, com_rate, com, pk.price - com, pk.delivery_days, pk.revisions)
  returning id into new_order;
  perform public._order_event(new_order, uid, 'Order placed', null, 'pending_payment', pk.name || ' package');
  perform public._trust(false);
  return new_order;
end $$;

-- ---------- Payments ----------
create or replace function public.submit_bank_transfer(p_order uuid, p_payer_name text, p_payer_reference text, p_proof_path text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o orders; pay uuid;
begin
  select * into o from orders where id = p_order for update;
  if not found or o.client_id <> uid then raise exception 'Order not found'; end if;
  if o.status <> 'pending_payment' or o.payment_status not in ('unpaid', 'rejected') then raise exception 'Payment already submitted for this order'; end if;
  if char_length(coalesce(p_payer_reference, '')) < 4 then raise exception 'Enter the bank transaction reference'; end if;
  if p_proof_path is null or split_part(p_proof_path, '/', 1) <> p_order::text or split_part(p_proof_path, '/', 2) <> uid::text then
    raise exception 'Upload proof of payment';
  end if;
  perform public._trust(true);
  insert into payments (order_id, client_id, amount, method, status, payer_name, payer_reference, proof_path)
  values (o.id, uid, o.total_amount, 'bank_transfer', 'awaiting_verification', p_payer_name, trim(p_payer_reference), p_proof_path)
  returning id into pay;
  update orders set payment_status = 'awaiting_verification' where id = o.id;
  perform public._order_event(o.id, uid, 'Bank transfer submitted — awaiting verification', o.status, o.status, p_payer_reference);
  perform public._notify_admins('payment_review', 'Payment awaiting verification', o.order_number || ' · PKR ' || o.total_amount, '/admin/payments');
  perform public._trust(false);
  return pay;
exception when unique_violation then
  raise exception 'This transaction reference was already submitted';
end $$;

-- Internal: moves a verified payment to paid and activates the order. Idempotent.
create or replace function public._confirm_payment(p_payment uuid, p_actor uuid, p_provider_txn text) returns void
language plpgsql security definer set search_path = public as $$
declare p payments; o orders; next_status public.order_status;
begin
  select * into p from payments where id = p_payment for update;
  if not found then raise exception 'Payment not found'; end if;
  if p.status = 'paid' then return; end if;                -- already processed: no double credit
  if p.status <> 'awaiting_verification' then raise exception 'Payment is %', p.status; end if;
  select * into o from orders where id = p.order_id for update;
  if o.status <> 'pending_payment' then raise exception 'Order is not awaiting payment'; end if;
  if p.amount <> o.total_amount then raise exception 'Payment amount does not match order total'; end if;

  perform public._trust(true);
  update payments set status = 'paid', verified_by = p_actor, verified_at = now(),
         provider_txn_id = coalesce(p_provider_txn, provider_txn_id) where id = p.id;
  next_status := case when o.offer_id is not null then 'active' else 'pending_acceptance' end;
  update orders set payment_status = 'paid', status = next_status,
         accepted_at = case when next_status = 'active' then now() end,
         due_at = case when next_status = 'active' then now() + make_interval(days => o.delivery_days) end
  where id = o.id;
  perform public._order_event(o.id, p_actor, 'Payment confirmed', o.status, next_status, p.reference);
  perform public._notify(o.client_id, 'payment', 'Payment confirmed', o.order_number || ' is now ' || replace(next_status::text, '_', ' '), '/app/orders/' || o.id);
  perform public._notify(o.freelancer_id, 'new_order',
    case when next_status = 'active' then 'New order started' else 'New order — please accept' end, o.title, '/app/orders/' || o.id);
  perform public._trust(false);
end $$;
revoke execute on function public._confirm_payment(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.admin_review_payment(p_payment uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin(); p payments;
begin
  select * into p from payments where id = p_payment for update;
  if not found then raise exception 'Payment not found'; end if;
  if p.method <> 'bank_transfer' then raise exception 'Online payments are confirmed by provider webhooks only'; end if;
  if p_approve then
    if p.status = 'paid' then raise exception 'Payment already verified'; end if;
    perform public._confirm_payment(p.id, uid, null);
  else
    if p.status <> 'awaiting_verification' then raise exception 'Payment is %', p.status; end if;
    if char_length(coalesce(p_note, '')) < 5 then raise exception 'Give a reason for rejecting'; end if;
    perform public._trust(true);
    update payments set status = 'rejected', rejection_reason = p_note, verified_by = uid, verified_at = now() where id = p.id;
    update orders set payment_status = 'rejected' where id = p.order_id;
    perform public._order_event(p.order_id, uid, 'Payment rejected', 'pending_payment', 'pending_payment', p_note);
    perform public._notify(p.client_id, 'payment', 'Payment could not be verified', p_note, '/app/orders/' || p.order_id);
    perform public._trust(false);
  end if;
  perform public._trust(true);
  perform public._audit(case when p_approve then 'payment.approve' else 'payment.reject' end, 'payment', p.id::text,
                        jsonb_build_object('order_id', p.order_id, 'amount', p.amount, 'note', p_note));
  perform public._trust(false);
end $$;

-- Called only by the payment webhook edge function (service role) after verifying the provider signature
create or replace function public.provider_payment_succeeded(p_order uuid, p_provider text, p_provider_txn text, p_amount numeric) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; pay uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Forbidden'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if exists (select 1 from payments where provider_txn_id = p_provider_txn and status = 'paid') then return; end if;
  if p_amount <> o.total_amount then raise exception 'Amount mismatch'; end if;
  select id into pay from payments where order_id = o.id and status = 'awaiting_verification' and method = 'online';
  if pay is null then
    insert into payments (order_id, client_id, amount, method, provider, status, provider_txn_id)
    values (o.id, o.client_id, o.total_amount, 'online', p_provider, 'awaiting_verification', p_provider_txn) returning id into pay;
  end if;
  perform public._confirm_payment(pay, null, p_provider_txn);
end $$;
revoke execute on function public.provider_payment_succeeded(uuid, text, text, numeric) from public, anon, authenticated;

-- ---------- Order workflow ----------
create or replace function public.freelancer_respond_order(p_order uuid, p_accept boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o orders;
begin
  select * into o from orders where id = p_order for update;
  if not found or o.freelancer_id <> uid then raise exception 'Order not found'; end if;
  if o.status <> 'pending_acceptance' then raise exception 'Order is not awaiting acceptance'; end if;
  perform public._trust(true);
  if p_accept then
    update orders set status = 'active', accepted_at = now(), due_at = now() + make_interval(days => o.delivery_days) where id = o.id;
    perform public._order_event(o.id, uid, 'Order accepted — work started', o.status, 'active', p_note);
    perform public._notify(o.client_id, 'order_accepted', 'Your order was accepted', o.title, '/app/orders/' || o.id);
  else
    if char_length(coalesce(p_note, '')) < 5 then raise exception 'Give the client a reason'; end if;
    update orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_note, payment_status = 'refund_pending' where id = o.id;
    insert into refunds (order_id, payment_id, amount, reason)
    values (o.id, (select id from payments where order_id = o.id and status = 'paid'), o.total_amount, 'Declined by freelancer: ' || p_note);
    perform public._order_event(o.id, uid, 'Order declined by freelancer', o.status, 'cancelled', p_note);
    perform public._notify(o.client_id, 'order_cancelled', 'Order declined — refund pending', p_note, '/app/orders/' || o.id);
    perform public._notify_admins('refund', 'Refund pending', o.order_number, '/admin/payments');
  end if;
  perform public._trust(false);
end $$;

create or replace function public.deliver_order(p_order uuid, p_message text, p_files jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o orders; f jsonb;
begin
  select * into o from orders where id = p_order for update;
  if not found or o.freelancer_id <> uid then raise exception 'Order not found'; end if;
  if o.status not in ('active', 'revision_requested') then raise exception 'This order cannot be delivered now'; end if;
  if jsonb_typeof(coalesce(p_files, '[]'::jsonb)) <> 'array' then raise exception 'Invalid files'; end if;
  for f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    if split_part(f->>'path', '/', 1) <> o.id::text then raise exception 'Invalid delivery file'; end if;
  end loop;
  perform public._trust(true);
  insert into deliveries (order_id, freelancer_id, message, files, revision_number) values (o.id, uid, p_message, coalesce(p_files, '[]'::jsonb), o.revision_count);
  update orders set status = 'delivered', delivered_at = now() where id = o.id;
  perform public._order_event(o.id, uid, case when o.revision_count > 0 then 'Revised work delivered' else 'Work delivered' end, o.status, 'delivered', null);
  perform public._notify(o.client_id, 'delivery', 'Your order was delivered', 'Review the delivery for ' || o.title, '/app/orders/' || o.id);
  perform public._trust(false);
end $$;

create or replace function public.request_revision(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o orders;
begin
  select * into o from orders where id = p_order for update;
  if not found or o.client_id <> uid then raise exception 'Order not found'; end if;
  if o.status <> 'delivered' then raise exception 'You can only request a revision on a delivered order'; end if;
  if o.revision_count >= o.revision_limit then raise exception 'Revision limit reached (% of %)', o.revision_count, o.revision_limit; end if;
  perform public._trust(true);
  insert into revision_requests (order_id, delivery_id, client_id, reason)
  values (o.id, (select id from deliveries where order_id = o.id order by created_at desc limit 1), uid, p_reason);
  update orders set status = 'revision_requested', revision_count = revision_count + 1,
         due_at = now() + make_interval(days => greatest(1, least(o.delivery_days, 3))) where id = o.id;
  perform public._order_event(o.id, uid, 'Revision requested', o.status, 'revision_requested', p_reason);
  perform public._notify(o.freelancer_id, 'revision', 'Revision requested', o.title, '/app/orders/' || o.id);
  perform public._trust(false);
end $$;

create or replace function public._complete_order(p_order uuid, p_actor uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_order for update;
  if o.payment_status <> 'paid' then raise exception 'Order is not paid'; end if;
  perform public._trust(true);
  update orders set status = 'completed', completed_at = now() where id = o.id;
  insert into ledger_entries (user_id, order_id, kind, bucket, amount, description, created_by)
  values (o.freelancer_id, o.id, 'order_earning', 'pending', o.freelancer_earning,
          'Earning for ' || o.order_number || ' (PKR ' || o.price || ' − ' || (o.commission_rate * 100)::numeric(5,2) || '% commission)', p_actor);
  update profiles set completed_orders = completed_orders + 1 where id = o.freelancer_id;
  if o.gig_id is not null then update gigs set orders_completed = orders_completed + 1 where id = o.gig_id; end if;
  perform public._order_event(o.id, p_actor, 'Order completed', o.status, 'completed', p_note);
  perform public._notify(o.freelancer_id, 'order_completed', 'Order completed', 'PKR ' || o.freelancer_earning || ' added to pending earnings', '/app/orders/' || o.id);
  perform public._notify(o.client_id, 'order_completed', 'Order completed', 'Leave a review for ' || o.title, '/app/orders/' || o.id);
  perform public._trust(false);
end $$;
revoke execute on function public._complete_order(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.approve_delivery(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o orders;
begin
  select * into o from orders where id = p_order for update;
  if not found or o.client_id <> uid then raise exception 'Order not found'; end if;
  if o.status <> 'delivered' then raise exception 'Only delivered orders can be approved'; end if;
  perform public._complete_order(o.id, uid, 'Approved by client');
end $$;

create or replace function public.cancel_unpaid_order(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o orders;
begin
  select * into o from orders where id = p_order for update;
  if not found or uid not in (o.client_id, o.freelancer_id) then raise exception 'Order not found'; end if;
  if o.status <> 'pending_payment' or o.payment_status not in ('unpaid', 'rejected') then
    raise exception 'Paid orders can only be cancelled through a dispute';
  end if;
  perform public._trust(true);
  update orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = o.id;
  perform public._order_event(o.id, uid, 'Order cancelled before payment', o.status, 'cancelled', p_reason);
  perform public._notify(case when uid = o.client_id then o.freelancer_id else o.client_id end, 'order_cancelled', 'Order cancelled', o.title, '/app/orders/' || o.id);
  perform public._trust(false);
end $$;

create or replace function public.open_dispute(p_order uuid, p_reason text, p_details text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o orders; d uuid;
begin
  select * into o from orders where id = p_order for update;
  if not found or uid not in (o.client_id, o.freelancer_id) then raise exception 'Order not found'; end if;
  if o.status not in ('pending_acceptance', 'active', 'delivered', 'revision_requested') or o.payment_status <> 'paid' then
    raise exception 'A dispute can only be opened on a paid, in-progress order';
  end if;
  perform public._trust(true);
  insert into disputes (order_id, opened_by, reason, details) values (o.id, uid, p_reason, p_details) returning id into d;
  update orders set status_before_dispute = status, status = 'disputed' where id = o.id;
  perform public._order_event(o.id, uid, 'Dispute opened', o.status, 'disputed', p_reason);
  perform public._notify(case when uid = o.client_id then o.freelancer_id else o.client_id end, 'dispute', 'A dispute was opened', o.title, '/app/orders/' || o.id);
  perform public._notify_admins('dispute', 'New dispute', o.order_number || ' · ' || p_reason, '/admin/disputes');
  perform public._trust(false);
  return d;
end $$;

create or replace function public.admin_resolve_dispute(p_dispute uuid, p_outcome text, p_resolution text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin(); d disputes; o orders;
begin
  select * into d from disputes where id = p_dispute for update;
  if not found or d.status not in ('open', 'under_review') then raise exception 'Dispute is not open'; end if;
  if char_length(coalesce(p_resolution, '')) < 10 then raise exception 'Write a resolution note'; end if;
  select * into o from orders where id = d.order_id for update;
  perform public._trust(true);
  if p_outcome = 'refund_client' then
    update orders set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Dispute: ' || p_resolution, payment_status = 'refund_pending' where id = o.id;
    insert into refunds (order_id, payment_id, amount, reason)
    values (o.id, (select id from payments where order_id = o.id and status = 'paid'), o.total_amount, 'Dispute resolved in client''s favour');
    perform public._order_event(o.id, uid, 'Dispute resolved — refund to client', 'disputed', 'cancelled', p_resolution);
  elsif p_outcome = 'complete_order' then
    perform public._complete_order(o.id, uid, 'Dispute resolved — order completed');
    perform public._trust(true);
  elsif p_outcome = 'resume_order' then
    update orders set status = coalesce(o.status_before_dispute, 'active') where id = o.id;
    perform public._order_event(o.id, uid, 'Dispute resolved — order resumed', 'disputed', coalesce(o.status_before_dispute, 'active'), p_resolution);
  else
    raise exception 'Invalid outcome';
  end if;
  update disputes set status = 'resolved', outcome = p_outcome, resolution = p_resolution, resolved_by = uid, resolved_at = now() where id = d.id;
  perform public._notify(o.client_id, 'dispute', 'Dispute resolved', p_resolution, '/app/orders/' || o.id);
  perform public._notify(o.freelancer_id, 'dispute', 'Dispute resolved', p_resolution, '/app/orders/' || o.id);
  perform public._audit('dispute.resolve', 'dispute', d.id::text, jsonb_build_object('order_id', o.id, 'outcome', p_outcome));
  perform public._trust(false);
end $$;

create or replace function public.admin_cancel_order(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin(); o orders;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status in ('completed', 'cancelled', 'refunded') then raise exception 'Order is already %', o.status; end if;
  perform public._trust(true);
  update orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason,
         payment_status = case when o.payment_status = 'paid' then 'refund_pending' else o.payment_status end where id = o.id;
  if o.payment_status = 'paid' then
    insert into refunds (order_id, payment_id, amount, reason)
    values (o.id, (select id from payments where order_id = o.id and status = 'paid'), o.total_amount, 'Cancelled by admin: ' || p_reason);
  end if;
  update disputes set status = 'closed', resolution = 'Order cancelled by admin', resolved_by = uid, resolved_at = now()
   where order_id = o.id and status in ('open', 'under_review');
  perform public._order_event(o.id, uid, 'Order cancelled by admin', o.status, 'cancelled', p_reason);
  perform public._notify(o.client_id, 'order_cancelled', 'Order cancelled by HN support', p_reason, '/app/orders/' || o.id);
  perform public._notify(o.freelancer_id, 'order_cancelled', 'Order cancelled by HN support', p_reason, '/app/orders/' || o.id);
  perform public._audit('order.cancel', 'order', o.id::text, jsonb_build_object('reason', p_reason));
  perform public._trust(false);
end $$;

create or replace function public.admin_process_refund(p_refund uuid, p_approve boolean, p_reference text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin(); r refunds;
begin
  select * into r from refunds where id = p_refund for update;
  if not found or r.status <> 'pending' then raise exception 'Refund is not pending'; end if;
  perform public._trust(true);
  if p_approve then
    if char_length(coalesce(p_reference, '')) < 3 then raise exception 'Enter the refund transaction reference'; end if;
    update refunds set status = 'processed', reference = p_reference, processed_by = uid, processed_at = now() where id = r.id;
    update payments set status = 'refunded' where id = r.payment_id;
    update orders set status = 'refunded', payment_status = 'refunded' where id = r.order_id;
    perform public._order_event(r.order_id, uid, 'Refund processed', 'cancelled', 'refunded', p_reference);
    perform public._notify((select client_id from orders where id = r.order_id), 'payment', 'Refund processed', 'Reference: ' || p_reference, '/app/orders/' || r.order_id);
  else
    update refunds set status = 'rejected', reference = p_reference, processed_by = uid, processed_at = now() where id = r.id;
    update orders set payment_status = 'paid' where id = r.order_id;
  end if;
  perform public._audit(case when p_approve then 'refund.process' else 'refund.reject' end, 'refund', r.id::text,
                        jsonb_build_object('order_id', r.order_id, 'amount', r.amount, 'reference', p_reference));
  perform public._trust(false);
end $$;

-- Auto-complete deliveries the client ignored (run daily via pg_cron, see docs)
create or replace function public.auto_complete_delivered_orders() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; days numeric := public.setting_num('auto_complete_days', 3);
begin
  if not (public.is_trusted_context() or public.is_admin()) then raise exception 'Forbidden'; end if;
  for r in select id from orders where status = 'delivered' and delivered_at < now() - make_interval(days => days::int) loop
    perform public._complete_order(r.id, null, 'Auto-completed: no response from client within ' || days || ' days');
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.send_deadline_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not (public.is_trusted_context() or public.is_admin()) then raise exception 'Forbidden'; end if;
  perform public._trust(true);
  for r in select * from orders where status in ('active', 'revision_requested') and not deadline_reminded
           and due_at between now() and now() + interval '24 hours' loop
    perform public._notify(r.freelancer_id, 'deadline', 'Delivery due within 24 hours', r.title, '/app/orders/' || r.id);
    update orders set deadline_reminded = true where id = r.id;
    n := n + 1;
  end loop;
  perform public._trust(false);
  return n;
end $$;

-- ---------- Reviews ----------
create or replace function public.leave_review(p_order uuid, p_rating int, p_comment text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o orders; rid uuid;
begin
  select * into o from orders where id = p_order;
  if not found or o.client_id <> uid then raise exception 'Order not found'; end if;
  if o.status <> 'completed' then raise exception 'You can review only completed orders'; end if;
  if p_rating not between 1 and 5 then raise exception 'Rating must be 1–5'; end if;
  insert into reviews (order_id, gig_id, client_id, freelancer_id, rating, comment)
  values (o.id, o.gig_id, uid, o.freelancer_id, p_rating, nullif(trim(p_comment), '')) returning id into rid;
  perform public._trust(true);
  perform public._notify(o.freelancer_id, 'review', 'New ' || p_rating || '-star review', o.title, '/app/reviews');
  perform public._trust(false);
  return rid;
exception when unique_violation then raise exception 'You already reviewed this order';
end $$;

create or replace function public.respond_review(p_review uuid, p_response text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active();
begin
  update reviews set response = p_response, response_at = now()
  where id = p_review and freelancer_id = uid and response is null;
  if not found then raise exception 'Review not found or already answered'; end if;
end $$;

create or replace function public.reviews_recalc() returns trigger
language plpgsql security definer set search_path = public as $$
declare f uuid := coalesce(new.freelancer_id, old.freelancer_id); g uuid := coalesce(new.gig_id, old.gig_id);
begin
  perform public._trust(true);
  update profiles set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from reviews where freelancer_id = f and not is_hidden), 0),
    rating_count = (select count(*) from reviews where freelancer_id = f and not is_hidden)
  where id = f;
  if g is not null then
    update gigs set
      rating_avg = coalesce((select round(avg(rating)::numeric, 2) from reviews where gig_id = g and not is_hidden), 0),
      rating_count = (select count(*) from reviews where gig_id = g and not is_hidden)
    where id = g;
  end if;
  perform public._trust(false);
  return null;
end $$;
create trigger reviews_recalc after insert or update or delete on public.reviews for each row execute function public.reviews_recalc();

-- ---------- Wallet & withdrawals ----------
create or replace function public.release_cleared_earnings(p_user uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; days int := public.setting_num('clearance_days', 7)::int; target uuid := p_user;
begin
  if not (public.is_trusted_context() or public.is_admin()) then target := auth.uid(); end if;
  perform public._trust(true);
  for r in
    select l.* from ledger_entries l join orders o on o.id = l.order_id
    where l.kind = 'order_earning' and (target is null or l.user_id = target)
      and o.completed_at < now() - make_interval(days => days)
      and not exists (select 1 from ledger_entries x where x.order_id = l.order_id and x.kind = 'release')
  loop
    insert into ledger_entries (user_id, order_id, kind, bucket, amount, description)
    values (r.user_id, r.order_id, 'release', 'pending', -r.amount, 'Cleared after ' || days || '-day clearance'),
           (r.user_id, r.order_id, 'release', 'available', r.amount, 'Cleared after ' || days || '-day clearance');
    n := n + 1;
  end loop;
  perform public._trust(false);
  return n;
end $$;

create or replace function public.get_wallet_summary() returns table (
  pending numeric, available numeric, total_earned numeric, total_commission numeric, withdrawn numeric, in_withdrawal numeric, clearance_days int, min_withdrawal numeric)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(amount) from ledger_entries where user_id = auth.uid() and bucket = 'pending'), 0),
    coalesce((select sum(amount) from ledger_entries where user_id = auth.uid() and bucket = 'available'), 0),
    coalesce((select sum(amount) from ledger_entries where user_id = auth.uid() and kind = 'order_earning'), 0),
    coalesce((select sum(commission_amount) from orders where freelancer_id = auth.uid() and status = 'completed'), 0),
    coalesce((select sum(amount) from withdrawals where freelancer_id = auth.uid() and status = 'paid'), 0),
    coalesce((select sum(amount) from withdrawals where freelancer_id = auth.uid() and status in ('requested', 'under_review', 'approved', 'processing')), 0),
    public.setting_num('clearance_days', 7)::int,
    public.setting_num('min_withdrawal', 1000);
$$;

create or replace function public.request_withdrawal(p_amount numeric, p_method uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); m payout_methods; bal numeric; w uuid;
begin
  if not exists (select 1 from profiles where id = uid and role = 'freelancer') then raise exception 'Only freelancers can withdraw'; end if;
  perform pg_advisory_xact_lock(hashtext('withdraw:' || uid::text));
  select * into m from payout_methods where id = p_method and user_id = uid;
  if not found then raise exception 'Choose a payout method'; end if;
  if p_amount < public.setting_num('min_withdrawal', 1000) then raise exception 'Minimum withdrawal is PKR %', public.setting_num('min_withdrawal', 1000); end if;
  select coalesce(sum(amount), 0) into bal from ledger_entries where user_id = uid and bucket = 'available';
  if p_amount > bal then raise exception 'Amount exceeds your available balance (PKR %)', bal; end if;
  perform public._trust(true);
  insert into withdrawals (freelancer_id, payout_method_id, payout_snapshot, amount)
  values (uid, m.id, jsonb_build_object('method', m.method, 'account_title', m.account_title, 'bank_name', m.bank_name, 'account_number', m.account_number), p_amount)
  returning id into w;
  insert into ledger_entries (user_id, withdrawal_id, kind, bucket, amount, description, created_by)
  values (uid, w, 'withdrawal_hold', 'available', -p_amount, 'Withdrawal request', uid);
  perform public._notify_admins('withdrawal', 'Withdrawal requested', 'PKR ' || p_amount, '/admin/withdrawals');
  perform public._trust(false);
  return w;
exception when unique_violation then raise exception 'You already have a withdrawal in progress';
end $$;

create or replace function public.admin_update_withdrawal(p_id uuid, p_status public.withdrawal_status, p_note text default null, p_reference text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin(); w withdrawals; ok boolean;
begin
  select * into w from withdrawals where id = p_id for update;
  if not found then raise exception 'Withdrawal not found'; end if;
  ok := (w.status = 'requested'    and p_status in ('under_review', 'approved', 'rejected'))
     or (w.status = 'under_review' and p_status in ('approved', 'rejected'))
     or (w.status = 'approved'     and p_status in ('processing', 'rejected'))
     or (w.status = 'processing'   and p_status in ('paid', 'rejected'));
  if not ok then raise exception 'Cannot move a withdrawal from % to %', w.status, p_status; end if;
  if p_status = 'paid' and char_length(coalesce(p_reference, '')) < 3 then raise exception 'Enter the bank/wallet transfer reference'; end if;
  if p_status = 'rejected' and char_length(coalesce(p_note, '')) < 5 then raise exception 'Give a reason for rejecting'; end if;
  perform public._trust(true);
  update withdrawals set status = p_status, admin_note = coalesce(p_note, admin_note), reference = coalesce(p_reference, reference),
         processed_by = uid, paid_at = case when p_status = 'paid' then now() else paid_at end where id = w.id;
  if p_status = 'rejected' then
    insert into ledger_entries (user_id, withdrawal_id, kind, bucket, amount, description, created_by)
    values (w.freelancer_id, w.id, 'withdrawal_reversal', 'available', w.amount, 'Withdrawal rejected — funds returned', uid);
  end if;
  perform public._notify(w.freelancer_id, 'withdrawal', 'Withdrawal ' || replace(p_status::text, '_', ' '),
                         'PKR ' || w.amount || coalesce(' · ' || p_note, ''), '/app/wallet');
  perform public._audit('withdrawal.' || p_status, 'withdrawal', w.id::text, jsonb_build_object('amount', w.amount, 'reference', p_reference, 'note', p_note));
  perform public._trust(false);
end $$;

-- ---------- Calls ----------
create or replace function public.start_call(p_conversation uuid, p_media text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); callee uuid; cid uuid;
begin
  if p_media not in ('audio', 'video') then raise exception 'Invalid call type'; end if;
  if not exists (select 1 from conversation_participants where conversation_id = p_conversation and user_id = uid) then raise exception 'Conversation not found'; end if;
  select user_id into callee from conversation_participants where conversation_id = p_conversation and user_id <> uid limit 1;
  if callee is null or public.is_blocked_between(uid, callee) then raise exception 'Cannot call this user'; end if;
  -- expire stale ringing calls, and close any call the caller left open (e.g. closed the tab mid-call)
  update calls set status = 'missed', ended_at = now() where status = 'ringing' and created_at < now() - interval '60 seconds'
    and (caller_id in (uid, callee) or callee_id in (uid, callee));
  update calls set status = 'ended', ended_at = now(), end_reason = 'stale' where status in ('ringing', 'accepted') and uid in (caller_id, callee_id);
  if exists (select 1 from calls where (status = 'ringing' or (status = 'accepted' and created_at > now() - interval '2 hours'))
             and (caller_id = callee or callee_id = callee)) then
    raise exception 'User is on another call';
  end if;
  insert into calls (conversation_id, caller_id, callee_id, media) values (p_conversation, uid, callee, p_media) returning id into cid;
  insert into call_events (call_id, user_id, event) values (cid, uid, 'started');
  return cid;
end $$;

create or replace function public.update_call(p_call uuid, p_status public.call_status, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c calls; label text; dur int;
begin
  select * into c from calls where id = p_call for update;
  if not found or uid not in (c.caller_id, c.callee_id) then raise exception 'Call not found'; end if;
  if c.status in ('rejected', 'missed', 'ended', 'failed') then return; end if;  -- already finished (idempotent)
  if p_status = 'accepted' then
    if uid <> c.callee_id or c.status <> 'ringing' then raise exception 'Cannot accept'; end if;
    update calls set status = 'accepted', answered_at = now() where id = c.id;
    insert into call_events (call_id, user_id, event) values (c.id, uid, 'accepted');
    return;
  end if;
  if p_status = 'rejected' and uid <> c.callee_id then raise exception 'Cannot reject'; end if;
  if p_status = 'ended' and c.status = 'ringing' then p_status := 'missed'; end if;
  if p_status not in ('rejected', 'missed', 'ended', 'failed') then raise exception 'Invalid status'; end if;
  dur := case when c.answered_at is not null then extract(epoch from now() - c.answered_at)::int end;
  update calls set status = p_status, ended_at = now(), duration_seconds = dur, end_reason = p_reason where id = c.id;
  insert into call_events (call_id, user_id, event, details) values (c.id, uid, p_status::text, p_reason);
  label := initcap(c.media) || ' call' || case
    when p_status = 'ended' then ' · ' || lpad((dur / 60)::text, 2, '0') || ':' || lpad((dur % 60)::text, 2, '0')
    when p_status = 'missed' then ' · missed' when p_status = 'rejected' then ' · declined' else ' · failed' end;
  perform public._trust(true);
  insert into messages (conversation_id, sender_id, kind, body, call_id) values (c.conversation_id, c.caller_id, 'call', label, c.id);
  if p_status = 'missed' then
    perform public._notify(c.callee_id, 'call', 'Missed ' || c.media || ' call', null, '/app/messages/' || c.conversation_id);
  end if;
  perform public._trust(false);
end $$;

-- ---------- Admin ----------
create or replace function public.admin_set_user_status(p_user uuid, p_status public.account_status, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin();
begin
  if p_user = uid then raise exception 'You cannot change your own status'; end if;
  perform public._trust(true);
  update profiles set status = p_status where id = p_user;
  if p_status = 'suspended' then update gigs set status = 'unpublished' where freelancer_id = p_user and status = 'published'; end if;
  perform public._audit('user.' || p_status, 'profile', p_user::text, jsonb_build_object('reason', p_reason));
  perform public._trust(false);
end $$;

create or replace function public.admin_set_verified(p_user uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  perform public._trust(true);
  update profiles set is_verified = p_verified where id = p_user and role = 'freelancer';
  if p_verified then perform public._notify(p_user, 'verification', 'Your profile is verified', 'A verified badge now shows on your profile.', '/app/settings'); end if;
  perform public._audit(case when p_verified then 'user.verify' else 'user.unverify' end, 'profile', p_user::text, '{}');
  perform public._trust(false);
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.user_role) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin();
begin
  if p_user = uid then raise exception 'You cannot change your own role'; end if;
  perform public._trust(true);
  update profiles set role = p_role where id = p_user;
  perform public._audit('user.role', 'profile', p_user::text, jsonb_build_object('role', p_role));
  perform public._trust(false);
end $$;

create or replace function public.admin_moderate_gig(p_gig uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare g gigs;
begin
  perform public._require_admin();
  select * into g from gigs where id = p_gig for update;
  if not found then raise exception 'Gig not found'; end if;
  perform public._trust(true);
  if p_approve then
    update gigs set status = 'published', rejection_reason = null, published_at = coalesce(published_at, now()) where id = g.id;
    perform public._notify(g.freelancer_id, 'gig', 'Your gig is live', g.title, '/gigs/' || g.id);
  else
    if char_length(coalesce(p_reason, '')) < 5 then raise exception 'Give a reason'; end if;
    update gigs set status = 'rejected', rejection_reason = p_reason where id = g.id;
    perform public._notify(g.freelancer_id, 'gig', 'Gig needs changes', p_reason, '/app/gigs/' || g.id || '/edit');
  end if;
  perform public._audit(case when p_approve then 'gig.approve' else 'gig.reject' end, 'gig', g.id::text, jsonb_build_object('reason', p_reason));
  perform public._trust(false);
end $$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin();
begin
  if p_key in ('commission_rate', 'client_service_fee_rate') and ((p_value #>> '{}')::numeric < 0 or (p_value #>> '{}')::numeric > 0.5) then
    raise exception 'Rate must be between 0 and 0.5';
  end if;
  insert into platform_settings (key, value, updated_by, updated_at) values (p_key, p_value, uid, now())
  on conflict (key) do update set value = excluded.value, updated_by = uid, updated_at = now();
  perform public._trust(true);
  perform public._audit('setting.update', 'setting', p_key, jsonb_build_object('value', p_value));
  perform public._trust(false);
end $$;

create or replace function public.admin_moderate_review(p_review uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  update reviews set is_hidden = p_hidden where id = p_review;
  perform public._trust(true);
  perform public._audit(case when p_hidden then 'review.hide' else 'review.show' end, 'review', p_review::text, '{}');
  perform public._trust(false);
end $$;

create or replace function public.admin_update_report(p_report uuid, p_status public.report_status, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_admin();
begin
  update reports set status = p_status, admin_note = p_note, handled_by = uid where id = p_report;
  perform public._trust(true);
  perform public._audit('report.' || p_status, 'report', p_report::text, jsonb_build_object('note', p_note));
  perform public._trust(false);
end $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'clients',            (select count(*) from profiles where role = 'client'),
    'freelancers',        (select count(*) from profiles where role = 'freelancer'),
    'suspended',          (select count(*) from profiles where status = 'suspended'),
    'gigs_published',     (select count(*) from gigs where status = 'published'),
    'gigs_pending',       (select count(*) from gigs where status = 'pending_review'),
    'orders_total',       (select count(*) from orders),
    'orders_by_status',   (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from orders group by status) s),
    'gross_paid',         (select coalesce(sum(amount), 0) from payments where status = 'paid'),
    'commission_earned',  (select coalesce(sum(commission_amount + service_fee), 0) from orders where status = 'completed'),
    'payments_pending',   (select count(*) from payments where status = 'awaiting_verification'),
    'refunds_pending',    (select count(*) from refunds where status = 'pending'),
    'withdrawals_open',   (select count(*) from withdrawals where status in ('requested', 'under_review', 'approved', 'processing')),
    'disputes_open',      (select count(*) from disputes where status in ('open', 'under_review')),
    'reports_open',       (select count(*) from reports where status in ('open', 'reviewing')),
    'signups_30d',        (select count(*) from profiles where created_at > now() - interval '30 days')
  );
end $$;

-- Admin email lookup for user management (emails live in auth.users and are never public)
create or replace function public.admin_list_users(p_search text default null, p_role public.user_role default null, p_limit int default 50, p_offset int default 0)
returns table (id uuid, email text, full_name text, role public.user_role, status public.account_status, is_verified boolean,
               created_at timestamptz, last_seen_at timestamptz, completed_orders int, email_confirmed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return query
  select p.id, u.email::text, p.full_name, p.role, p.status, p.is_verified, p.created_at, (select pp.last_seen_at from profile_private pp where pp.id = p.id), p.completed_orders, u.email_confirmed_at is not null
  from profiles p join auth.users u on u.id = p.id
  where (p_role is null or p.role = p_role)
    and (p_search is null or p.full_name ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%')
  order by p.created_at desc limit least(p_limit, 200) offset p_offset;
end $$;
