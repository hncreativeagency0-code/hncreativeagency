-- =====================================================================
-- Pakistan-only manual payment channels: bank transfer (IBAN), JazzCash,
-- Easypaisa and Raast. All in PKR; every payment is verified by an admin.
-- =====================================================================
alter table public.payments
  add column channel text not null default 'bank'
  check (channel in ('bank', 'jazzcash', 'easypaisa', 'raast'));

-- Admin-editable receiving accounts per channel (shown to clients at checkout)
insert into public.platform_settings (key, value) values ('payment_channels', '{
  "bank":      {"enabled": true,  "label": "Bank transfer (IBFT)"},
  "jazzcash":  {"enabled": false, "label": "JazzCash", "account_title": "", "number": ""},
  "easypaisa": {"enabled": false, "label": "Easypaisa", "account_title": "", "number": ""},
  "raast":     {"enabled": false, "label": "Raast", "account_title": "", "raast_id": ""}
}') on conflict (key) do nothing;

insert into public.platform_settings (key, value) values ('currency', '"PKR"') on conflict (key) do nothing;

-- Replace the bank-only function with one that takes the channel
drop function if exists public.submit_bank_transfer(uuid, text, text, text);

create or replace function public.submit_bank_transfer(p_order uuid, p_payer_name text, p_payer_reference text, p_proof_path text, p_channel text default 'bank') returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_active(); o orders; pay uuid; ch jsonb;
begin
  if p_channel not in ('bank', 'jazzcash', 'easypaisa', 'raast') then raise exception 'Choose a Pakistani payment method'; end if;
  select value -> p_channel into ch from platform_settings where key = 'payment_channels';
  if p_channel <> 'bank' and coalesce((ch ->> 'enabled')::boolean, false) is not true then
    raise exception '% is not available right now — choose another method', initcap(p_channel);
  end if;

  select * into o from orders where id = p_order for update;
  if not found or o.client_id <> uid then raise exception 'Order not found'; end if;
  if o.currency <> 'PKR' then raise exception 'Only PKR payments are accepted'; end if;
  if o.status <> 'pending_payment' or o.payment_status not in ('unpaid', 'rejected') then raise exception 'Payment already submitted for this order'; end if;
  if char_length(coalesce(p_payer_reference, '')) < 4 then raise exception 'Enter the transaction ID (TID) from your receipt'; end if;
  if p_proof_path is null or split_part(p_proof_path, '/', 1) <> p_order::text or split_part(p_proof_path, '/', 2) <> uid::text then
    raise exception 'Upload a screenshot of the payment receipt';
  end if;

  perform public._trust(true);
  insert into payments (order_id, client_id, amount, currency, method, channel, status, payer_name, payer_reference, proof_path)
  values (o.id, uid, o.total_amount, 'PKR', 'bank_transfer', p_channel, 'awaiting_verification', p_payer_name, trim(p_payer_reference), p_proof_path)
  returning id into pay;
  update orders set payment_status = 'awaiting_verification' where id = o.id;
  perform public._order_event(o.id, uid, initcap(p_channel) || ' payment submitted — awaiting verification', o.status, o.status, p_payer_reference);
  perform public._notify_admins('payment_review', 'Payment awaiting verification',
    o.order_number || ' · PKR ' || o.total_amount || ' via ' || initcap(p_channel), '/admin/payments');
  perform public._trust(false);
  return pay;
exception when unique_violation then
  raise exception 'This transaction ID was already submitted';
end $$;

-- Orders are PKR only
alter table public.orders add constraint orders_pkr_only check (currency = 'PKR');
alter table public.payments add constraint payments_pkr_only check (currency = 'PKR');
