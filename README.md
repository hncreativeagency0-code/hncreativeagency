# HN Creative Agency — Marketplace

**Design. Market. Grow.** A freelance marketplace (clients, freelancers, administrators) built on top of the original HN Creative Agency website, which now lives inside the app as the **Our Agency** page (`/agency`).

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS (Poppins / Inter, brand purple `#6C63FF`, navy `#0F172A`), light / dark / system theme
- **Backend:** Supabase — PostgreSQL with row-level security, Auth, Storage, Realtime, Edge Functions
- **Calls:** WebRTC, signalled over private Supabase Realtime channels, TURN via Cloudflare (or any TURN server)
- **Payments (Pakistan only, PKR):** bank transfer (IBFT), JazzCash, Easypaisa and Raast — each verified by an admin — plus an instant online checkout (card / wallets) that switches on once your Pakistani gateway account is approved
- **What changed in v1.1 (Oct 2026):** see **CHANGES.md** — every item from the *Mistakes List & Upgrade Plan* and where it lives in the code
- **Hosting:** Cloudflare Pages (frontend) + Supabase (everything else)

---

## 1. What's included

| Area | Status |
|---|---|
| Sign-up / login / logout, email verification, password reset, role choice (client/freelancer) | Ready |
| Profile completion, avatars, public freelancer profiles, private contact data | Ready |
| Gigs with Basic/Standard/Premium packages, gallery, FAQs, extras, requirements, portfolio samples | Ready |
| Admin moderation before gigs go live (toggle in settings) | Ready |
| Explore with search, category/subcategory, price, rating, delivery-time, availability filters, sorting, pagination | Ready |
| Favourites, saved freelancers, reports | Ready |
| Real-time chat: unread counts, typing, read receipts, online/last seen (privacy-aware), replies, images/files, voice messages, search, block/report | Ready |
| Custom project requests and custom offers inside chat | Ready |
| Audio & video calls with accept/decline, mute, camera, duration, missed-call records | Ready — add TURN for reliability (§5) |
| Orders: payment → acceptance → active → delivery → revisions (limit enforced) → completion → review; disputes; cancellations; activity timeline | Ready |
| Checkout with Pakistani methods only — bank transfer, JazzCash, Easypaisa, Raast — with TID + receipt upload and admin verification; PKR enforced in the database | Ready — enter your receiving accounts in Admin → Settings → Payment methods |
| Instant online checkout (card / JazzCash / Easypaisa via a gateway) | UI + secure server functions ready — needs a merchant account (§6) |
| Low fees: 0% client fee up to PKR 5,000, 3% above; 10% commission (9% Rising, 8% Top, 0% Founding Freelancers) | Ready — all editable in Admin → Settings |
| Coupons (promo codes, first-order WELCOME10), late-delivery credit, referral rewards | Ready |
| Post a Request → proposals → hire (creates the order) | Ready |
| Freelancer verification (CNIC + work samples, private bucket) and seller levels (New → Rising → Top) | Ready |
| Managed projects, agency packages in PKR, free consultation booking (leads inbox for admins) | Ready |
| Gig analytics (views, contact clicks, orders, conversion), gig quality checklist, writing helper | Ready |
| Two-step login (authenticator app), database rate limiting on forms/messages | Ready |
| Pricing & Fees, Money-Back Guarantee, Trust & Safety, Case Studies, Blog (5 SEO articles), service pages | Ready |
| SEO: per-page titles/descriptions/structured data, sitemap.xml, robots.txt, Cloudflare meta middleware | Ready |
| Analytics (GA4, Meta Pixel, Search Console), PWA (installable), Urdu/English toggle, WhatsApp button | Ready — add your IDs (§8) |
| WhatsApp notifications | Ready — needs WhatsApp Cloud API credentials (§7) |
| Earnings ledger (append-only), clearance period, wallet, payout methods, withdrawals (manual payout workflow) | Ready |
| In-app notifications (realtime) | Ready |
| Email notifications | Ready — needs a Resend key (§7) |
| Admin: stats, users (suspend/verify/role), gigs, categories, orders, payments, refunds, withdrawals, disputes, reports, reviews, contact messages, ledger & audit logs, platform settings | Ready |
| Public pages: Home, Our Agency (original site), Explore, Freelancers, Gig, Profile, About, Contact, How It Works, Help, Terms, Privacy, Refund policy | Ready (have a lawyer review the policies) |

**Honesty rules built in:** no fake reviews, sales or stats. All ratings, counts and dashboard numbers come from database rows. Unproven claims from the old site (award-winning, worldwide, 150+ projects, typed-in testimonials, brand logos) were removed — `/agency` now shows only reviews from real completed orders. Add case studies in `src/content/caseStudies.ts` only with client permission.

---

## 2. Security model (why this is safe)

- Every table has **row-level security**. Users can read only what they are party to (their orders, conversations, ledger, payout methods).
- Orders, payments, earnings, withdrawals, disputes, reviews and moderation have **no direct write access**. Every state change goes through a `SECURITY DEFINER` Postgres function that checks *who* is calling and whether the transition is valid (e.g. only the client can approve a delivery; revisions stop at the package limit; an order can't be delivered before payment).
- **Commission and fees are computed in the database**, never in the browser.
- **Payments:** a bank transfer becomes "paid" only when an admin approves it. Online payments can only be marked paid by the webhook (service role) after signature verification **and** re-checking with the provider. One live payment per order, unique transaction references, idempotent processing.
- **Ledger is append-only** (update/delete blocked by trigger). Balances are sums of ledger rows; withdrawals hold funds immediately and return them if rejected; only one open withdrawal per freelancer.
- Users can't make themselves admin, verified, or change their ratings — a trigger strips those columns.
- Private files (chat attachments, deliveries, payment proofs) are in private buckets, readable only by the parties, served through 10-minute signed URLs.
- Admin actions are recorded in an append-only audit log.
- No secrets in the frontend. The anon key is public by design; everything privileged lives in edge-function secrets.

Run the database test suite (applies all migrations to an in-memory Postgres and runs the full workflow, including 23 abuse attempts that must be blocked):

```bash
npm run test:db
```

---

## 3. Folder structure

```
hn-marketplace/
├─ public/                     static assets (+ _redirects, _headers for Cloudflare Pages)
│  └─ assets/images/           ← copy your old logo/favicon/CEO photo here (scripts/copy-legacy-assets.sh)
├─ src/
│  ├─ App.tsx                  routes (public, /app, /admin)
│  ├─ components/              Layout (nav, footer, dashboards), ui kit, cards, TagInput
│  ├─ context/                 Auth (+notifications, presence), Theme, Toast, Call (WebRTC)
│  ├─ lib/                     supabase client, storage helpers, hooks, types, utils
│  └─ pages/
│     ├─ public/               Home, Agency (old site), Explore, GigDetail, FreelancerProfile, Contact, static pages
│     ├─ auth/                 Login, Register, Forgot/Reset password
│     ├─ app/                  Dashboard, Orders, OrderDetail, Checkout, Messages, Gigs, Portfolio, Wallet, Settings, Misc
│     └─ admin/                Admin pages
├─ supabase/
│  ├─ migrations/              schema, business functions, RLS/storage/realtime, default settings & categories
│  ├─ functions/               turn-credentials, payment-webhook, send-email (Deno edge functions)
│  ├─ admin/                   make_admin.sql, schedule_jobs.sql
│  └─ tests/                   workflow.test.mjs
├─ docs/PAYMENTS.md            Pakistan gateway notes & manual-transfer operations
└─ .env.example
```

---

## 4. Setup

### 4.1 Prerequisites
- Node.js 18+ and npm
- A Supabase project (free tier is fine to start) — https://supabase.com
- Supabase CLI (`npm i -g supabase`) for migrations and edge functions

### 4.2 Install and run locally
```bash
npm install
cp .env.example .env          # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run assets:copy           # copies logo, favicon, project images, CEO photo from the old site (or: bash scripts/copy-legacy-assets.sh ~/old-site-folder)
npm run images:optimize       # makes small .webp copies the site loads first
npm run dev                   # http://localhost:5173
```
**Do the asset copy before you deploy over the old site.** Image order: `/public` .webp → `/public` original → old live site → branded placeholder, so a missing file never shows a broken image.

### 4.3 Database
```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push              # applies supabase/migrations in order
```
(Without the CLI: paste each file from `supabase/migrations/` into **SQL Editor** in filename order.)

This creates all tables, functions, policies, the six storage buckets, realtime publications, default fees (10% freelancer commission, 0% client fee up to PKR 5,000 then 3%, 7-day clearance), the WELCOME10 first-order coupon and the ten starter categories.

### 4.4 Authentication settings (Supabase Dashboard → Authentication)
1. **Sign In / Providers → Email:** enable, and keep **Confirm email** ON.
2. **URL Configuration:** Site URL = your live URL (e.g. `https://hncreativeagency.pages.dev`). Add Redirect URLs: `http://localhost:5173/**` and `https://YOUR-DOMAIN/**`.
3. **Emails → SMTP:** Supabase's built-in mailer is rate-limited; connect your own SMTP (e.g. Resend, Zoho, Gmail Workspace) before launch.
4. **Attack protection:** enable leaked-password protection and CAPTCHA if you see spam sign-ups.

### 4.5 Realtime
Dashboard → **Realtime → Settings**: turn **off** "Allow public access" so channels require the authorization policies the migration created (typing, presence and call signalling are private).

### 4.6 Create the first admin (secure)
Register on the site with your email → verify it → run `supabase/admin/make_admin.sql` in the SQL Editor (edit the email first). Nobody can become admin from the website.

Then in **Admin → Settings → Payment methods**, turn on the methods you accept and enter the receiving accounts (business IBAN, JazzCash/Easypaisa numbers, Raast ID). Clients only see methods that are switched on and filled in.

### 4.7 Background jobs (recommended)
Enable the `pg_cron` extension and run `supabase/admin/schedule_jobs.sql` (earnings release, auto-complete, deadline reminders, stale calls).

---

## 5. Calls (audio/video)

Calls work peer-to-peer. With STUN only, most home and mobile connections work, but some office/carrier networks need a **TURN relay**:

**Cloudflare Realtime TURN (recommended, generous free tier):**
1. Cloudflare Dashboard → Realtime → TURN Server → Create → copy the **Key ID** and **API token**.
2. ```bash
   supabase secrets set CLOUDFLARE_TURN_KEY_ID=... CLOUDFLARE_TURN_API_TOKEN=... SITE_URL=https://your-domain
   supabase functions deploy turn-credentials
   ```
The function only hands credentials to signed-in users. Any other TURN server works via `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`.

Calls require HTTPS (or localhost) and browser camera/microphone permission.

---

## 6. Payments

Summary (operations details in docs/PAYMENTS.md):

- **Now:** Pakistani methods only, in PKR — bank transfer (IBFT), JazzCash, Easypaisa, Raast. Client chooses a method, pays the shown account, enters the TID and uploads the receipt → *Awaiting verification* → admin matches the TID on the statement and approves in **Admin → Payments** → order starts. Rejections go back to the client with a reason. Any other method or currency is refused by the database.
- **Payouts:** manual. Freelancers request withdrawals; admin sends the transfer from the business account and marks it *Paid* with the bank reference. Clearly labelled as manual in the UI.
- **Refunds:** created automatically when a paid order is declined, cancelled by admin, or a dispute is resolved for the client; admin records the refund reference.
- **Instant online checkout:** the checkout page shows **Pay instantly** when Admin → Settings → *Instant online payments* is on and a gateway is chosen. It calls `supabase/functions/create-payment-session` (redirects to the gateway's hosted page) and the gateway confirms via `supabase/functions/payment-webhook` (signature check, idempotency, provider re-verification, amount check). Fill in the two marked `ADAPT` adapters from your gateway's documentation (Safepay / PayFast — confirm current availability and marketplace terms with them), test in sandbox, then switch it on. Manual methods stay as the backup.

```bash
supabase secrets set PAYMENT_PROVIDER=safepay PAYMENT_API_KEY=... PAYMENT_API_BASE=... PAYMENT_WEBHOOK_SECRET=... SITE_URL=https://your-domain
supabase functions deploy create-payment-session
supabase functions deploy payment-webhook --no-verify-jwt
```

**Wording:** the site says “your payment is safe until you approve the delivery” (payment protection). Have a lawyer confirm this wording and the guarantee for your business structure.

---

## 7. Email notifications (optional)
```bash
supabase secrets set RESEND_API_KEY=... EMAIL_FROM="HN Creative Agency <notifications@yourdomain.com>" WEBHOOK_SECRET=$(openssl rand -hex 24) SITE_URL=https://your-domain
supabase functions deploy send-email --no-verify-jwt
```
Then Dashboard → **Database → Webhooks → Create**: table `notifications`, event `INSERT`, type *Supabase Edge Function* → `send-email`, HTTP header `x-webhook-secret: <same WEBHOOK_SECRET>`. Users can opt out in Settings. (Verify your sending domain in Resend.)

**WhatsApp alerts (optional):** create a WhatsApp Cloud API app in Meta Business, register your number, and get a message template approved with two body variables (`{{1}}` title, `{{2}}` link). Then `supabase secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_ID=... WHATSAPP_TEMPLATE=order_update` and redeploy `send-email`. Users opt in under Settings → Account.

---

## 8. Deploy to Cloudflare Pages

1. Push this folder to a **private** GitHub repository (`.env` is git-ignored — never commit keys).
2. Cloudflare Dashboard → Workers & Pages → your existing `hncreativeagency` Pages project → **Settings → Builds**:
   - Framework preset: *None* / Vite
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variables (Production *and* Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `NODE_VERSION=20`, and optionally `VITE_SITE_URL` (your domain), `VITE_SUPPORT_EMAIL` (e.g. support@yourdomain.com), `VITE_GA_ID`, `VITE_META_PIXEL_ID`, `VITE_GSC_VERIFICATION`
3. Connect the repo (or `npx wrangler pages deploy dist --project-name hncreativeagency`).
4. `public/_redirects` makes client-side routes work; `public/_headers` adds security headers, long caching for assets and allows camera/mic. `functions/_middleware.js` (Cloudflare Pages Function, deployed automatically from the repo) writes the right title/description/share image into each page's HTML for Google and WhatsApp/Facebook previews. `npm run build` also writes `dist/sitemap.xml` — submit it in Google Search Console.

Back up the old static site first (download it or keep it on a branch) — this replaces it at the same URL.

### Custom domain
Pages project → **Custom domains** → add `yourdomain.com` (and `www`). Then update the Supabase **Site URL / Redirect URLs** and the `SITE_URL` secret to the new domain.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Visitors see “We’ll be right back” | `VITE_SUPABASE_*` env vars missing at **build** time — set them and rebuild (the browser console says which). |
| Verification / reset emails don't arrive | Check spam; configure custom SMTP (§4.4); check Site URL & Redirect URLs. |
| Routes 404 on refresh | Make sure `public/_redirects` is deployed. |
| Typing indicator / calls don't connect but chat works | Realtime private channels: confirm migration 3 ran and "Allow public access" setting (§4.5). |
| Call rings but never connects | Add a TURN server (§5); check browser camera/mic permission; must be HTTPS. |
| "permission denied for function …" | Expected for internal functions — call the public RPC instead. |
| Uploads fail | Check file size/type limits in `supabase/migrations/…_security.sql` (storage buckets). |
| Freelancer balance not moving to available | Opens of the wallet release cleared earnings; or enable cron (§4.7). Check `clearance_days`. |
| Gig stuck "In review" | An admin approves it in Admin → Gigs, or turn off moderation in Admin → Settings. |

---

## 10. Before launch — checklist
- [ ] Copy legacy assets into `public/` (`npm run assets:copy && npm run images:optimize`) **before** deploying
- [ ] Domain email (support@yourdomain.com) in Admin → Settings → Contact details and `VITE_SUPPORT_EMAIL`
- [ ] Company registration details in Admin → Settings (shown on About)
- [ ] 20–50 real gigs from your team and trusted freelancers; first case studies with client permission
- [ ] GA4 / Meta Pixel / Search Console IDs; submit sitemap.xml
- [ ] Review fees, Founding programme and coupons in Admin → Settings / Coupons; confirm tax (GST/withholding) with an accountant
- [ ] Custom SMTP for auth emails
- [ ] Receiving accounts (IBAN, JazzCash, Easypaisa, Raast) in Admin → Settings → Payment methods
- [ ] TURN server for calls
- [ ] Lawyer review of Terms, Privacy and Refund policies
- [ ] Gateway merchant account (if you want card/wallet checkout) — then implement the webhook adapter and test in sandbox
- [ ] Enable pg_cron jobs
- [ ] Create a test client + test freelancer and run one full order end-to-end on the live site
