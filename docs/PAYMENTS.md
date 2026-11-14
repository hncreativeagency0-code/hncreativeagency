# Payments — Pakistan

## What works today
**Pakistan only, PKR only, verified by an admin.** No gateway contract required.

| Method | Client pays to | Reference they enter |
|---|---|---|
| Bank transfer (IBFT) | Your business IBAN | IBFT ref / RRN / STAN |
| JazzCash | Your JazzCash mobile account | JazzCash TID |
| Easypaisa | Your Easypaisa mobile account | Easypaisa transaction ID |
| Raast | Your Raast ID (registered mobile number) | Raast transaction ID |

The database rejects any other method, and orders and payments can only be in PKR.

1. Admin switches on the methods and enters the receiving accounts in **Admin → Settings → Payment methods**.
2. Client places an order → **Checkout** shows the total (price + service fee), lets them choose a method, and shows that account plus the order number to put in the remarks.
3. Client pays, then submits: the payer's name, the transaction ID and a receipt screenshot/PDF (stored in a private bucket).
4. Order shows **Awaiting verification**. Admins are notified.
5. Admin opens **Admin → Payments → To verify**, views the receipt, **checks the business bank statement**, then:
   - **Approve** → payment *Paid*, order moves to *Pending acceptance* (gig orders) or *Active* (custom offers), both parties notified.
   - **Reject** with a reason → client can resubmit.

Safeguards: amount must equal the order total; one live payment per order; the same bank reference can't be reused; every approval is in the audit log.

> Never approve from the screenshot alone. Screenshots are easy to fake — confirm the TID and amount on your bank, JazzCash or Easypaisa statement.

## Payouts to freelancers (manual)
- On completion, the freelancer's net earning (price − commission) enters **pending** in the ledger.
- After `clearance_days` (default 7) it moves to **available**.
- Freelancer requests a withdrawal to a saved bank IBAN / JazzCash / Easypaisa / Raast ID → funds are held.
- Admin: **Requested → Approved → Processing → Paid** (Paid requires the transfer reference) or **Rejected** (funds return automatically).

## Refunds
Created automatically when a paid order is declined by the freelancer, cancelled by an admin, or a dispute is resolved for the client. Admin sends the money back and records the reference in **Admin → Payments → Refunds**.

## Choosing an online gateway
Gateways commonly used by Pakistani merchants include **Safepay** (hosted checkout accepting cards and Easypaisa/JazzCash wallets in PKR, signed webhooks) and **PayFast** (regulated PSP, PCI-DSS certified, cards/accounts/wallets). Others exist (bank gateways, JazzCash/Easypaisa direct).

Before choosing, ask each provider in writing:
1. Do you onboard a **marketplace** (we collect from clients and pay many freelancers)? Some providers only approve single-merchant sales of your own services.
2. Do you support **split payments / payouts to third parties**? If not, keep the manual payout workflow (already built).
3. Settlement time, fees, refund API, chargeback handling, and required documents (NTN, business bank account, website policies).
4. Webhook **signature scheme** and a **transaction-status API** for server-side verification.

Do not advertise escrow unless your provider and legal structure actually provide it.

## Fees (v1.1)
- Client service fee: **0% on orders up to PKR 5,000**, then **3%** (`client_fee_free_threshold`, `client_service_fee_rate`).
- Freelancer commission: **10%**, Rising Seller 9%, Top Seller 8% (`commission_rate`, `level_commission`), **0% for Founding Freelancers** during their offer (`founding_program`).
- Coupons reduce what the client pays; the freelancer's earning is unchanged (the discount comes out of HN's margin).
- Gateway charges must fit inside the client fee + commission. Confirm GST / withholding tax with an accountant.

## Connecting a gateway (developer steps)
1. Get sandbox credentials.
2. Fill in `createCheckout()` in `supabase/functions/create-payment-session/index.ts` (already called by the checkout page's **Pay instantly** button).
3. In `supabase/functions/payment-webhook/index.ts`, replace:
   - `verifySignature()` with the provider's documented signature check,
   - `parseEvent()` field names,
   - `confirmWithProvider()` with the provider's transaction-status call.
4. `supabase secrets set PAYMENT_PROVIDER=... PAYMENT_WEBHOOK_SECRET=... PAYMENT_API_KEY=... PAYMENT_API_BASE=...`
5. `supabase functions deploy payment-webhook --no-verify-jwt` and register `https://<project-ref>.supabase.co/functions/v1/payment-webhook` with the provider.
6. Test: success, failure, duplicate webhook, wrong amount, forged signature. Check **Admin → Transactions & logs → Payment webhooks**.
7. Only then choose the gateway and switch on **Admin → Settings → Instant online payments**. The "Pay instantly" button appears at checkout; manual methods remain as a backup.

The database side is already done: `provider_payment_succeeded()` can only be executed by the service role, is idempotent per provider transaction, and re-checks the amount.
