-- =====================================================================
-- Row-level security, storage buckets, realtime authorization
-- Rule of thumb: users READ only what they're party to; financial and
-- workflow tables have NO direct write policies (functions only).
-- =====================================================================
do $$ declare t text; begin
  foreach t in array array['profiles','profile_private','platform_settings','categories','gigs','gig_packages','portfolio_items',
    'favorite_gigs','saved_freelancers','orders','conversations','conversation_participants','custom_requests','custom_offers',
    'calls','call_events','messages','user_blocks','order_events','deliveries','revision_requests','payments','payment_events',
    'refunds','payout_methods','withdrawals','ledger_entries','reviews','notifications','disputes','reports','audit_logs','contact_messages']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- Profiles: public read (no private data in this table), owner update (guard trigger protects sensitive columns)
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy private_own on public.profile_private for select to authenticated using (id = auth.uid() or public.is_admin());
create policy private_update on public.profile_private for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy settings_read on public.platform_settings for select using (key not like 'internal_%' or public.is_admin());

create policy categories_read on public.categories for select using (is_active or public.is_admin());
create policy categories_admin on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Gigs
create policy gigs_read on public.gigs for select using (
  (status = 'published' and exists (select 1 from public.profiles p where p.id = freelancer_id and p.status = 'active'))
  or freelancer_id = auth.uid() or public.is_admin());
create policy gigs_insert on public.gigs for insert to authenticated with check (
  freelancer_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'freelancer' and p.status = 'active'));
create policy gigs_update on public.gigs for update to authenticated using (freelancer_id = auth.uid()) with check (freelancer_id = auth.uid());
create policy gigs_delete on public.gigs for delete to authenticated using (
  freelancer_id = auth.uid() and not exists (select 1 from public.orders o where o.gig_id = gigs.id and o.status not in ('completed', 'cancelled', 'refunded')));

create policy packages_read on public.gig_packages for select using (exists (select 1 from public.gigs g where g.id = gig_id));
create policy packages_write on public.gig_packages for all to authenticated
  using (exists (select 1 from public.gigs g where g.id = gig_id and g.freelancer_id = auth.uid()))
  with check (exists (select 1 from public.gigs g where g.id = gig_id and g.freelancer_id = auth.uid()));

create policy portfolio_read on public.portfolio_items for select using (is_published or freelancer_id = auth.uid() or public.is_admin());
create policy portfolio_write on public.portfolio_items for all to authenticated using (freelancer_id = auth.uid()) with check (freelancer_id = auth.uid());

create policy fav_own on public.favorite_gigs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_own on public.saved_freelancers for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Orders & workflow records: parties + admin read; writes only via functions
create policy orders_read on public.orders for select to authenticated using (auth.uid() in (client_id, freelancer_id) or public.is_admin());
create policy order_events_read on public.order_events for select to authenticated using (public.is_order_party(order_id) or public.is_admin());
create policy deliveries_read on public.deliveries for select to authenticated using (public.is_order_party(order_id) or public.is_admin());
create policy revisions_read on public.revision_requests for select to authenticated using (public.is_order_party(order_id) or public.is_admin());
create policy disputes_read on public.disputes for select to authenticated using (public.is_order_party(order_id) or public.is_admin());
create policy refunds_read on public.refunds for select to authenticated using (public.is_order_party(order_id) or public.is_admin());

-- Payments: the paying client + admin. Event payloads are admin-only.
create policy payments_read on public.payments for select to authenticated using (client_id = auth.uid() or public.is_admin());
create policy payment_events_read on public.payment_events for select to authenticated using (public.is_admin());

-- Money: owner + admin read; never writable by users
create policy ledger_read on public.ledger_entries for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy withdrawals_read on public.withdrawals for select to authenticated using (freelancer_id = auth.uid() or public.is_admin());
create policy payout_read on public.payout_methods for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy payout_insert on public.payout_methods for insert to authenticated with check (user_id = auth.uid());
create policy payout_update on public.payout_methods for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy payout_delete on public.payout_methods for delete to authenticated using (user_id = auth.uid());

-- Messaging
create policy conversations_read on public.conversations for select to authenticated using (public.is_conversation_participant(id) or public.is_admin());
create policy participants_read on public.conversation_participants for select to authenticated using (public.is_conversation_participant(conversation_id));
create policy messages_read on public.messages for select to authenticated using (public.is_conversation_participant(conversation_id) or public.is_admin());
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and public.is_conversation_participant(conversation_id));
create policy requests_read on public.custom_requests for select to authenticated using (auth.uid() in (client_id, freelancer_id));
create policy offers_read on public.custom_offers for select to authenticated using (auth.uid() in (client_id, freelancer_id) or public.is_admin());
create policy calls_read on public.calls for select to authenticated using (auth.uid() in (caller_id, callee_id));
create policy call_events_read on public.call_events for select to authenticated
  using (exists (select 1 from public.calls c where c.id = call_id and auth.uid() in (c.caller_id, c.callee_id)));
create policy blocks_own on public.user_blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- Reviews: public unless hidden
create policy reviews_read on public.reviews for select using (not is_hidden or auth.uid() in (client_id, freelancer_id) or public.is_admin());

-- Notifications
create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
-- users may only flip is_read
create or replace function public.notifications_guard() returns trigger language plpgsql as $$
begin
  if public.is_trusted_context() then return new; end if;
  new.user_id := old.user_id; new.type := old.type; new.title := old.title; new.body := old.body; new.link := old.link;
  new.created_at := old.created_at; new.emailed := old.emailed;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications for each row execute function public.notifications_guard();

-- Reports
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open' and handled_by is null);
create policy reports_read on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());

create policy audit_read on public.audit_logs for select to authenticated using (public.is_admin());

create policy contact_insert on public.contact_messages for insert with check (handled = false);
create policy contact_admin on public.contact_messages for select to authenticated using (public.is_admin());
create policy contact_admin_update on public.contact_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- Storage
-- Public buckets: avatars, gig-media, portfolio  (path: <user_id>/<file>)
-- Private buckets: chat-files (<conversation_id>/<user_id>/<file>),
--   deliveries (<order_id>/<user_id>/<file>), payment-proofs (<order_id>/<user_id>/<file>)
-- Private files are served with short-lived signed URLs only.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('gig-media', 'gig-media', true, 26214400, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']),
  ('portfolio', 'portfolio', true, 52428800, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']),
  ('chat-files', 'chat-files', false, 52428800, null),
  ('deliveries', 'deliveries', false, 209715200, null),
  ('payment-proofs', 'payment-proofs', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "public media read" on storage.objects for select using (bucket_id in ('avatars', 'gig-media', 'portfolio'));
create policy "public media owner write" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'gig-media', 'portfolio') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public media owner update" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'gig-media', 'portfolio') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public media owner delete" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'gig-media', 'portfolio') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "chat files read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-files' and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])));
create policy "chat files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and (storage.foldername(name))[2] = auth.uid()::text
              and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])));

create policy "deliveries read" on storage.objects for select to authenticated
  using (bucket_id = 'deliveries' and (public.is_order_party(public.try_uuid((storage.foldername(name))[1])) or public.is_admin()));
create policy "deliveries write" on storage.objects for insert to authenticated
  with check (bucket_id = 'deliveries' and (storage.foldername(name))[2] = auth.uid()::text
              and exists (select 1 from public.orders o where o.id = public.try_uuid((storage.foldername(name))[1])
                          and o.freelancer_id = auth.uid() and o.status in ('active', 'revision_requested')));

create policy "proofs read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin()));
create policy "proofs write" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[2] = auth.uid()::text
              and exists (select 1 from public.orders o where o.id = public.try_uuid((storage.foldername(name))[1])
                          and o.client_id = auth.uid() and o.status = 'pending_payment'));

-- =====================================================================
-- Realtime
-- postgres_changes respects the RLS above. Private broadcast channels
-- (typing, presence, WebRTC signaling) are authorized here.
-- =====================================================================
alter publication supabase_realtime add table public.messages, public.notifications, public.calls,
  public.orders, public.conversation_participants, public.conversations;

create policy "hn private channels read" on realtime.messages for select to authenticated using (
  (split_part(realtime.topic(), ':', 1) = 'conv' and public.is_conversation_participant(public.try_uuid(split_part(realtime.topic(), ':', 2))))
  or (split_part(realtime.topic(), ':', 1) = 'call' and exists (
        select 1 from public.calls c where c.id = public.try_uuid(split_part(realtime.topic(), ':', 2)) and auth.uid() in (c.caller_id, c.callee_id)))
  or realtime.topic() = 'online-users');
create policy "hn private channels write" on realtime.messages for insert to authenticated with check (
  (split_part(realtime.topic(), ':', 1) = 'conv' and public.is_conversation_participant(public.try_uuid(split_part(realtime.topic(), ':', 2))))
  or (split_part(realtime.topic(), ':', 1) = 'call' and exists (
        select 1 from public.calls c where c.id = public.try_uuid(split_part(realtime.topic(), ':', 2)) and auth.uid() in (c.caller_id, c.callee_id)))
  or realtime.topic() = 'online-users');
