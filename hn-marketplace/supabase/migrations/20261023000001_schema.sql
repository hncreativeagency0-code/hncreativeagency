-- =====================================================================
-- HN Creative Agency Marketplace — core schema
-- Run with `supabase db push` (or paste each migration into the SQL editor in order).
-- =====================================================================
-- gen_random_uuid() is built into PostgreSQL 13+; no extension needed.

-- ---------- Enums ----------
create type public.user_role        as enum ('client', 'freelancer', 'admin');
create type public.account_status   as enum ('active', 'suspended');
create type public.gig_status       as enum ('draft', 'pending_review', 'published', 'unpublished', 'rejected');
create type public.order_status     as enum ('pending_payment', 'pending_acceptance', 'active', 'delivered',
                                             'revision_requested', 'completed', 'cancelled', 'refunded', 'disputed');
create type public.payment_status   as enum ('unpaid', 'awaiting_verification', 'paid', 'rejected', 'refund_pending', 'refunded');
create type public.offer_status     as enum ('pending', 'accepted', 'declined', 'withdrawn', 'expired');
create type public.withdrawal_status as enum ('requested', 'under_review', 'approved', 'processing', 'paid', 'rejected');
create type public.dispute_status   as enum ('open', 'under_review', 'resolved', 'closed');
create type public.report_status    as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type public.message_kind     as enum ('text', 'image', 'file', 'voice', 'offer', 'request', 'system', 'call');
create type public.call_status      as enum ('ringing', 'accepted', 'rejected', 'missed', 'ended', 'failed');
create type public.ledger_kind      as enum ('order_earning', 'release', 'withdrawal_hold', 'withdrawal_reversal', 'refund_reversal', 'adjustment');

-- ---------- Generic helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create or replace function public.try_uuid(p text) returns uuid
language plpgsql immutable as $$
begin return p::uuid; exception when others then return null; end $$;

-- ---------- Profiles ----------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  role              public.user_role not null default 'client',
  full_name         text not null default '' check (char_length(full_name) <= 80),
  username          text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  avatar_url        text,
  title             text check (char_length(title) <= 100),
  bio               text check (char_length(bio) <= 2000),
  skills            text[] not null default '{}',
  years_experience  int check (years_experience between 0 and 60),
  education         jsonb not null default '[]'::jsonb,
  certifications    jsonb not null default '[]'::jsonb,
  languages         text[] not null default '{}',
  hourly_rate       numeric(12,2) check (hourly_rate >= 0),
  country           text check (char_length(country) <= 60),
  city              text check (char_length(city) <= 60),
  availability      text not null default 'available' check (availability in ('available', 'busy', 'away')),
  is_verified       boolean not null default false,
  status            public.account_status not null default 'active',
  profile_completed boolean not null default false,
  show_online_status boolean not null default true,
  rating_avg        numeric(3,2) not null default 0,
  rating_count      int not null default 0,
  completed_orders  int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role) where status = 'active';
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Private contact data: owner + admin only
create table public.profile_private (
  id          uuid primary key references public.profiles(id) on delete cascade,
  phone       text check (char_length(phone) <= 30),
  whatsapp    text check (char_length(whatsapp) <= 30),
  email_notifications boolean not null default true,
  last_seen_at timestamptz,                      -- private; exposed only via get_my_conversations() when allowed
  updated_at  timestamptz not null default now()
);

-- ---------- Platform settings ----------
create table public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

-- ---------- Categories ----------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.categories(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text,
  icon        text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index categories_parent_idx on public.categories (parent_id);

-- ---------- Gigs ----------
create or replace function public.tags_to_text(text[]) returns text
language sql immutable parallel safe as $$ select array_to_string($1, ' ') $$;

create table public.gigs (
  id              uuid primary key default gen_random_uuid(),
  freelancer_id   uuid not null references public.profiles(id) on delete cascade,
  category_id     uuid references public.categories(id) on delete set null,
  subcategory_id  uuid references public.categories(id) on delete set null,
  title           text not null check (char_length(title) between 15 and 120),
  description     text not null default '' check (char_length(description) <= 8000),
  tags            text[] not null default '{}' check (cardinality(tags) <= 10),
  cover_url       text,
  gallery         text[] not null default '{}' check (cardinality(gallery) <= 8),
  portfolio_ids   uuid[] not null default '{}',
  requirements    text check (char_length(requirements) <= 3000),
  faqs            jsonb not null default '[]'::jsonb,
  extras          jsonb not null default '[]'::jsonb,
  status          public.gig_status not null default 'draft',
  rejection_reason text,
  starting_price  numeric(12,2),
  min_delivery_days int,
  rating_avg      numeric(3,2) not null default 0,
  rating_count    int not null default 0,
  orders_completed int not null default 0,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  search          tsvector generated always as (
                    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                    setweight(to_tsvector('simple', public.tags_to_text(tags)), 'B') ||
                    setweight(to_tsvector('simple', coalesce(description, '')), 'C')) stored
);
create index gigs_freelancer_idx on public.gigs (freelancer_id);
create index gigs_status_idx on public.gigs (status, created_at desc);
create index gigs_category_idx on public.gigs (category_id) where status = 'published';
create index gigs_search_idx on public.gigs using gin (search);
create trigger gigs_updated before update on public.gigs for each row execute function public.set_updated_at();

create table public.gig_packages (
  id            uuid primary key default gen_random_uuid(),
  gig_id        uuid not null references public.gigs(id) on delete cascade,
  tier          text not null check (tier in ('basic', 'standard', 'premium')),
  name          text not null check (char_length(name) between 2 and 60),
  description   text check (char_length(description) <= 500),
  price         numeric(12,2) not null check (price >= 500 and price <= 10000000),
  delivery_days int not null check (delivery_days between 1 and 90),
  revisions     int not null default 1 check (revisions between 0 and 20),
  features      text[] not null default '{}',
  unique (gig_id, tier)
);

-- ---------- Portfolio ----------
create table public.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 3 and 100),
  description   text check (char_length(description) <= 2000),
  media         jsonb not null default '[]'::jsonb,   -- [{url, type: 'image'|'video'}]
  link_url      text check (link_url is null or link_url ~* '^https?://'),
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index portfolio_freelancer_idx on public.portfolio_items (freelancer_id);
create trigger portfolio_updated before update on public.portfolio_items for each row execute function public.set_updated_at();

-- ---------- Favorites ----------
create table public.favorite_gigs (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  gig_id     uuid not null references public.gigs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, gig_id)
);
create table public.saved_freelancers (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, freelancer_id)
);

-- ---------- Orders (declared before conversations for FK) ----------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text not null unique default ('HN-' || to_char(now(), 'YYMM') || '-' || nextval('public.order_number_seq')),
  client_id          uuid not null references public.profiles(id),
  freelancer_id      uuid not null references public.profiles(id),
  gig_id             uuid references public.gigs(id) on delete set null,
  package_id         uuid references public.gig_packages(id) on delete set null,
  offer_id           uuid,
  title              text not null,
  package_tier       text,
  requirements       text check (char_length(requirements) <= 5000),
  requirement_files  jsonb not null default '[]'::jsonb,
  currency           text not null default 'PKR',
  price              numeric(12,2) not null check (price > 0),
  service_fee        numeric(12,2) not null default 0 check (service_fee >= 0),
  total_amount       numeric(12,2) not null check (total_amount > 0),
  commission_rate    numeric(5,4) not null check (commission_rate between 0 and 0.5),
  commission_amount  numeric(12,2) not null check (commission_amount >= 0),
  freelancer_earning numeric(12,2) not null check (freelancer_earning >= 0),
  delivery_days      int not null check (delivery_days between 1 and 180),
  due_at             timestamptz,
  status             public.order_status not null default 'pending_payment',
  status_before_dispute public.order_status,
  payment_status     public.payment_status not null default 'unpaid',
  revision_count     int not null default 0,
  revision_limit     int not null default 1,
  accepted_at        timestamptz,
  delivered_at       timestamptz,
  completed_at       timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  deadline_reminded  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (client_id <> freelancer_id)
);
create index orders_client_idx on public.orders (client_id, created_at desc);
create index orders_freelancer_idx on public.orders (freelancer_id, created_at desc);
create index orders_status_idx on public.orders (status);
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();

-- ---------- Messaging ----------
create table public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  created_by           uuid references public.profiles(id) on delete set null,
  order_id             uuid references public.orders(id) on delete set null,
  gig_id               uuid references public.gigs(id) on delete set null,
  last_message_at      timestamptz not null default now(),
  last_message_preview text,
  created_at           timestamptz not null default now()
);
create index conversations_last_idx on public.conversations (last_message_at desc);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index participants_user_idx on public.conversation_participants (user_id);

create table public.custom_requests (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  title         text not null check (char_length(title) between 5 and 120),
  description   text not null check (char_length(description) between 20 and 5000),
  budget        numeric(12,2) check (budget > 0),
  deadline      date,
  attachments   jsonb not null default '[]'::jsonb,
  status        text not null default 'open' check (status in ('open', 'offered', 'closed')),
  created_at    timestamptz not null default now()
);

create table public.custom_offers (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  freelancer_id   uuid not null references public.profiles(id),
  client_id       uuid not null references public.profiles(id),
  gig_id          uuid references public.gigs(id) on delete set null,
  request_id      uuid references public.custom_requests(id) on delete set null,
  title           text not null check (char_length(title) between 5 and 120),
  description     text not null check (char_length(description) between 10 and 3000),
  price           numeric(12,2) not null check (price >= 500 and price <= 10000000),
  delivery_days   int not null check (delivery_days between 1 and 180),
  revisions       int not null default 1 check (revisions between 0 and 20),
  status          public.offer_status not null default 'pending',
  expires_at      timestamptz not null default (now() + interval '7 days'),
  order_id        uuid references public.orders(id) on delete set null,
  created_at      timestamptz not null default now()
);
alter table public.orders add constraint orders_offer_fk foreign key (offer_id) references public.custom_offers(id) on delete set null;
create unique index orders_offer_unique on public.orders (offer_id) where offer_id is not null;

create table public.calls (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  caller_id        uuid not null references public.profiles(id),
  callee_id        uuid not null references public.profiles(id),
  media            text not null check (media in ('audio', 'video')),
  status           public.call_status not null default 'ringing',
  created_at       timestamptz not null default now(),
  answered_at      timestamptz,
  ended_at         timestamptz,
  duration_seconds int,
  end_reason       text
);
create index calls_callee_idx on public.calls (callee_id, created_at desc);

create table public.call_events (
  id         bigint generated always as identity primary key,
  call_id    uuid not null references public.calls(id) on delete cascade,
  user_id    uuid references public.profiles(id),
  event      text not null check (event in ('started', 'accepted', 'rejected', 'missed', 'ended', 'failed', 'media_error')),
  details    text,
  created_at timestamptz not null default now()
);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid references public.profiles(id) on delete set null,
  kind             public.message_kind not null default 'text',
  body             text check (char_length(body) <= 5000),
  reply_to_id      uuid references public.messages(id) on delete set null,
  attachment_path  text,
  attachment_name  text,
  attachment_mime  text,
  attachment_size  bigint check (attachment_size <= 52428800),
  duration_seconds numeric(8,2),
  offer_id         uuid references public.custom_offers(id) on delete set null,
  request_id       uuid references public.custom_requests(id) on delete set null,
  call_id          uuid references public.calls(id) on delete set null,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  check (body is not null or attachment_path is not null or offer_id is not null or request_id is not null or call_id is not null)
);
create index messages_conv_idx on public.messages (conversation_id, created_at desc);
create index messages_body_search_idx on public.messages using gin (to_tsvector('simple', coalesce(body, '')));

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ---------- Order lifecycle ----------
create table public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  actor_id    uuid references public.profiles(id),
  event       text not null,
  from_status public.order_status,
  to_status   public.order_status,
  note        text,
  created_at  timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.deliveries (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  freelancer_id   uuid not null references public.profiles(id),
  message         text not null check (char_length(message) between 5 and 5000),
  files           jsonb not null default '[]'::jsonb,  -- [{path,name,size,mime}]
  revision_number int not null default 0,
  created_at      timestamptz not null default now()
);
create index deliveries_order_idx on public.deliveries (order_id, created_at desc);

create table public.revision_requests (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  client_id   uuid not null references public.profiles(id),
  reason      text not null check (char_length(reason) between 10 and 3000),
  created_at  timestamptz not null default now()
);

-- ---------- Payments ----------
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete restrict,
  client_id        uuid not null references public.profiles(id),
  amount           numeric(12,2) not null check (amount > 0),
  currency         text not null default 'PKR',
  method           text not null check (method in ('bank_transfer', 'online')),
  provider         text,                                          -- e.g. 'safepay', 'payfast'
  status           public.payment_status not null default 'awaiting_verification',
  reference        text not null unique default ('PAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  provider_txn_id  text unique,
  payer_reference  text check (char_length(payer_reference) <= 80),
  payer_name       text check (char_length(payer_name) <= 80),
  proof_path       text,
  submitted_at     timestamptz not null default now(),
  verified_by      uuid references public.profiles(id),
  verified_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now()
);
-- Only one live payment per order (prevents duplicate submissions / double processing)
create unique index payments_one_live_per_order on public.payments (order_id) where status in ('awaiting_verification', 'paid');
create unique index payments_payer_ref_unique on public.payments (lower(payer_reference)) where payer_reference is not null and status <> 'rejected';
create index payments_status_idx on public.payments (status, created_at desc);

create table public.payment_events (
  id              bigint generated always as identity primary key,
  payment_id      uuid references public.payments(id) on delete set null,
  provider        text not null,
  event_type      text not null,
  idempotency_key text not null unique,
  signature_valid boolean not null,
  payload         jsonb not null,
  created_at      timestamptz not null default now()
);

create table public.refunds (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id),
  payment_id   uuid references public.payments(id),
  amount       numeric(12,2) not null check (amount > 0),
  reason       text not null,
  status       text not null default 'pending' check (status in ('pending', 'processed', 'rejected')),
  reference    text,
  processed_by uuid references public.profiles(id),
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);
create unique index refunds_one_open_per_order on public.refunds (order_id) where status in ('pending', 'processed');

-- ---------- Earnings ledger (append-only) ----------
create table public.payout_methods (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  method         text not null check (method in ('bank_account', 'jazzcash', 'easypaisa', 'raast')),
  account_title  text not null check (char_length(account_title) between 3 and 80),
  bank_name      text check (char_length(bank_name) <= 80),
  account_number text not null check (account_number ~ '^[A-Za-z0-9 +-]{6,34}$'),
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);
create index payout_methods_user_idx on public.payout_methods (user_id);

create table public.withdrawals (
  id               uuid primary key default gen_random_uuid(),
  freelancer_id    uuid not null references public.profiles(id),
  payout_method_id uuid references public.payout_methods(id) on delete set null,
  payout_snapshot  jsonb not null,
  amount           numeric(12,2) not null check (amount > 0),
  status           public.withdrawal_status not null default 'requested',
  admin_note       text,
  reference        text,
  processed_by     uuid references public.profiles(id),
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index withdrawals_one_open on public.withdrawals (freelancer_id) where status in ('requested', 'under_review', 'approved', 'processing');
create trigger withdrawals_updated before update on public.withdrawals for each row execute function public.set_updated_at();

create table public.ledger_entries (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles(id),
  order_id      uuid references public.orders(id),
  withdrawal_id uuid references public.withdrawals(id),
  kind          public.ledger_kind not null,
  bucket        text not null check (bucket in ('pending', 'available')),
  amount        numeric(12,2) not null check (amount <> 0),
  description   text not null,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index ledger_user_idx on public.ledger_entries (user_id, created_at desc);
create unique index ledger_one_earning_per_order on public.ledger_entries (order_id) where kind = 'order_earning';
create unique index ledger_one_release_per_order on public.ledger_entries (order_id, bucket) where kind = 'release';

create or replace function public.ledger_immutable() returns trigger language plpgsql as $$
begin raise exception 'Ledger entries are append-only'; end $$;
create trigger ledger_no_update before update or delete on public.ledger_entries
  for each row execute function public.ledger_immutable();

-- ---------- Reviews ----------
create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references public.orders(id) on delete cascade,
  gig_id        uuid references public.gigs(id) on delete set null,
  client_id     uuid not null references public.profiles(id),
  freelancer_id uuid not null references public.profiles(id),
  rating        int not null check (rating between 1 and 5),
  comment       text check (char_length(comment) <= 2000),
  response      text check (char_length(response) <= 1500),
  response_at   timestamptz,
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now()
);
create index reviews_freelancer_idx on public.reviews (freelancer_id, created_at desc);
create index reviews_gig_idx on public.reviews (gig_id, created_at desc);

-- ---------- Notifications ----------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  is_read    boolean not null default false,
  emailed    boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where not is_read;

-- ---------- Disputes & reports ----------
create table public.disputes (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  opened_by   uuid not null references public.profiles(id),
  reason      text not null check (reason in ('not_delivered', 'quality', 'late', 'communication', 'payment', 'other')),
  details     text not null check (char_length(details) between 20 and 5000),
  status      public.dispute_status not null default 'open',
  resolution  text,
  outcome     text check (outcome in ('refund_client', 'complete_order', 'resume_order')),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index disputes_one_open on public.disputes (order_id) where status in ('open', 'under_review');

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('gig', 'user', 'review', 'message')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'scam', 'inappropriate', 'copyright', 'harassment', 'off_platform_payment', 'other')),
  details     text check (char_length(details) <= 2000),
  status      public.report_status not null default 'open',
  admin_note  text,
  handled_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create unique index reports_no_dupes on public.reports (reporter_id, target_type, target_id) where status in ('open', 'reviewing');

create table public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles(id),
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create trigger audit_no_update before update or delete on public.audit_logs
  for each row execute function public.ledger_immutable();

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  service    text check (char_length(service) <= 80),
  message    text not null check (char_length(message) between 10 and 4000),
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
