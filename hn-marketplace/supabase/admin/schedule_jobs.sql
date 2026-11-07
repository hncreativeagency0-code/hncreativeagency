-- Optional but recommended: background jobs with pg_cron.
-- Enable first: Dashboard → Database → Extensions → pg_cron. Then run in the SQL Editor.

-- Move completed-order earnings from pending → available after the clearance period (hourly)
select cron.schedule('hn-release-earnings', '7 * * * *', $$ select public.release_cleared_earnings(); $$);

-- Auto-complete deliveries the client ignored (daily 03:10 UTC)
select cron.schedule('hn-auto-complete', '10 3 * * *', $$ select public.auto_complete_delivered_orders(); $$);

-- Deadline reminders to freelancers (every 30 minutes)
select cron.schedule('hn-deadline-reminders', '*/30 * * * *', $$ select public.send_deadline_reminders(); $$);

-- Close calls left "ringing" (e.g. a tab was closed)
select cron.schedule('hn-stale-calls', '*/5 * * * *',
  $$ update public.calls set status = 'missed', ended_at = now() where status = 'ringing' and created_at < now() - interval '2 minutes'; $$);

-- Note: freelancers' earnings are also released whenever they open their wallet/dashboard,
-- so the platform works without cron — cron just keeps balances fresh.
