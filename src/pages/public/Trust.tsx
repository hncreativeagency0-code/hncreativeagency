import { Link } from 'react-router-dom';
import { ShieldCheck, RotateCcw, BadgeCheck, Lock, Eye, MessageSquare, AlertTriangle, Clock, Users, Check, X, Wallet, Gavel, Flag, KeyRound, Ticket, TrendingUp, Award, Sparkles } from 'lucide-react';
import { ButtonLink, Card } from '@/components/ui';
import { FeeCalculator, SectionTitle, TierGrid, TrustBar } from '@/components/marketing';
import { usePublicSettings } from '@/lib/hooks';
import { useSeo } from '@/lib/seo';
import { estimate, FIVERR, pct } from '@/lib/fees';
import { SERVICES } from '@/content/services';
import { money, cn } from '@/lib/utils';
import { useSiteContact } from '@/lib/site';

function Hero({ eyebrow, title, sub, icon: Icon, urdu }: { eyebrow: string; title: string; sub: string; icon: typeof ShieldCheck; urdu?: string }) {
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white dark:from-navy-950 dark:to-navy-900">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand shadow-sm dark:bg-navy-800"><Icon className="h-4 w-4" />{eyebrow}</span>
        <h1 className="mt-5 font-heading text-4xl font-bold text-navy dark:text-white sm:text-5xl">{title}</h1>
        {urdu && <p className="mt-3 font-urdu text-xl text-brand" dir="rtl">{urdu}</p>}
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">{sub}</p>
      </div>
    </section>
  );
}

/* ------------------------------ Pricing & Fees ------------------------------ */
export function Pricing() {
  const s = usePublicSettings();
  const threshold = s?.client_fee_free_threshold ?? 5000;
  const feeRate = s?.client_service_fee_rate ?? 0.03;
  const com = s?.commission_rate ?? 0.1;
  useSeo({ title: 'Pricing & Fees – Lower Fees than Fiverr', description: `Freelancers keep ${100 - Math.round(com * 100)}% of every order. Clients pay no service fee up to PKR ${threshold.toLocaleString()} and ${pct(feeRate)} above. See the full fee breakdown and comparison.`, path: '/pricing' });
  const rows = [3000, 15000, 50000].map((price) => {
    const hn = estimate(price, s);
    const fvSeller = price * (1 - FIVERR.sellerRate);
    const fvBuyer = price * (1 + FIVERR.buyerRate);
    return { price, hn, fvSeller, fvBuyer };
  });
  return (
    <div>
      <Hero icon={Ticket} eyebrow="Pricing & Fees" title={`Only ${pct(com)} fee. No surprises.`}
        sub={`Freelancers keep ${100 - Math.round(com * 100)}% of every order. Clients pay no service fee on orders up to ${money(threshold)}, and just ${pct(feeRate)} above that.`} />
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { t: 'For clients', v: `0% up to ${money(threshold)}`, d: `${pct(feeRate)} service fee on larger orders. Shown before you pay.`, i: Users },
            { t: 'For freelancers', v: `${pct(com)} commission`, d: `Rising Sellers pay ${pct(s?.level_commission.rising ?? 0.09)}, Top Sellers ${pct(s?.level_commission.top ?? 0.08)}.`, i: TrendingUp },
            { t: 'Founding Freelancers', v: `${pct(s?.founding_program.commission_rate ?? 0)} for ${s?.founding_program.months ?? 3} months`, d: `For the first ${s?.founding_program.slots ?? 50} freelancers who join.`, i: Sparkles },
          ].map((x) => (
            <Card key={x.t} className="p-6">
              <x.i className="h-6 w-6 text-brand" />
              <p className="mt-3 text-sm font-medium text-muted">{x.t}</p>
              <p className="mt-1 font-heading text-2xl font-bold">{x.v}</p>
              <p className="mt-2 text-sm text-muted">{x.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionTitle title="See exactly what you pay" sub="Move the slider to see the fees for any order." />
        <FeeCalculator className="mx-auto mt-8 max-w-3xl" />
      </section>

      <section className="bg-surface py-14 dark:bg-navy-950/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle title="HN vs. international platforms" sub={`Fiverr figures use its published 20% seller fee and 5.5% buyer fee (checked ${FIVERR.checkedOn}; check fiverr.com for current rates). Fiverr also adds a small-order fee.`} />
          <Card className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs uppercase text-muted dark:border-navy-700">
                <th className="p-4">Order</th><th className="p-4">Fiverr — client pays</th><th className="p-4">Fiverr — seller gets</th><th className="p-4 text-brand">HN — client pays</th><th className="p-4 text-brand">HN — freelancer gets</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.price} className="border-b border-slate-50 last:border-0 dark:border-navy-700/50">
                    <td className="p-4 font-semibold">{money(r.price)}</td>
                    <td className="p-4">{money(Math.round(r.fvBuyer))}<span className="text-xs text-muted"> + small-order fee</span></td>
                    <td className="p-4">{money(Math.round(r.fvSeller))}</td>
                    <td className="p-4 font-semibold text-brand">{money(r.hn.clientPays)}</td>
                    <td className="p-4 font-semibold text-emerald-600">{money(r.hn.freelancerGets)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ['Local payments', 'JazzCash, Easypaisa, Raast and bank transfer — no dollar card needed.'],
              ['PKR pricing', 'Every price is in rupees. No currency conversion losses.'],
              ['Money-back guarantee', 'If the work isn’t delivered as agreed, you get a refund.'],
              ['Urdu & English support', 'Real people on WhatsApp, usually within an hour in support hours.'],
            ].map(([a, b]) => <Card key={a} className="p-5"><p className="font-semibold">{a}</p><p className="mt-1 text-sm text-muted">{b}</p></Card>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionTitle title="Typical package prices" sub="Recommended starting prices on HN. Each freelancer sets their own prices; agency packages are on the Agency page." />
        <div className="mt-10 space-y-10">
          {SERVICES.map((sv) => (
            <div key={sv.slug}>
              <div className="mb-3 flex items-end justify-between"><h3 className="font-heading text-lg font-semibold">{sv.name}{sv.monthly && <span className="text-sm font-normal text-muted"> · monthly</span>}</h3><Link to={`/services/${sv.slug}`} className="text-sm font-medium text-brand">Hire for {sv.name.toLowerCase()} →</Link></div>
              <TierGrid tiers={sv.tiers} monthly={sv.monthly} />
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-3"><ButtonLink to="/explore" size="lg">Browse services</ButtonLink><ButtonLink to="/agency#pricing" size="lg" variant="outline">Agency packages</ButtonLink></div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <h2 className="font-heading text-xl font-semibold">Fee details</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted [&_li]:flex [&_li]:gap-2">
          <li><Check className="h-4 w-4 shrink-0 text-emerald-500" />The client service fee is shown on the checkout page before you pay. Coupons reduce what you pay — the freelancer still receives their full earning.</li>
          <li><Check className="h-4 w-4 shrink-0 text-emerald-500" />Commission is deducted from the freelancer’s earning only when an order is completed. There is no fee to join, list gigs or send proposals.</li>
          <li><Check className="h-4 w-4 shrink-0 text-emerald-500" />Withdrawals to JazzCash, Easypaisa, Raast or bank are free from our side. Your bank or wallet may charge its own fee.</li>
          <li><Check className="h-4 w-4 shrink-0 text-emerald-500" />Payment gateway charges (for card payments, once available) are included in the service fee — never added on top.</li>
        </ul>
      </section>
    </div>
  );
}

/* ---------------------------- Money-back guarantee ---------------------------- */
export function Guarantee() {
  const s = usePublicSettings();
  useSeo({ title: 'Money-Back Guarantee – Work Done or Your Money Back', description: 'Your payment is held safely until you approve the delivery. If a freelancer doesn’t deliver, HN’s agency team completes the work or you get a refund.', path: '/guarantee' });
  return (
    <div>
      <Hero icon={RotateCcw} eyebrow="Money-back guarantee" title="Work done — or your money back" urdu="کام پورا یا پیسے واپس"
        sub="Hiring someone you haven’t met shouldn’t be a gamble. Here’s exactly how we protect every order on HN." />
      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { i: Lock, t: '1. Your payment is held', d: 'When you pay, the money stays with HN. The freelancer is paid only after you approve the delivery.' },
            { i: RotateCcw, t: '2. Revisions included', d: 'Every package lists its revisions. Ask for changes until the work matches what was agreed.' },
            { i: Gavel, t: '3. We step in', d: 'If something goes wrong, open a dispute. Our team reviews the order, the chat and the files.' },
          ].map((x) => <Card key={x.t} className="p-6"><x.i className="h-6 w-6 text-brand" /><h3 className="mt-3 font-heading font-semibold">{x.t}</h3><p className="mt-1.5 text-sm text-muted">{x.d}</p></Card>)}
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-7">
            <h2 className="flex items-center gap-2 font-heading text-xl font-semibold"><Check className="h-5 w-5 text-emerald-500" />You get a full refund if…</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted [&_li]:ml-5 [&_li]:list-disc">
              <li>The freelancer declines or cancels your paid order.</li>
              <li>Nothing is delivered and the freelancer stops responding.</li>
              <li>The delivery clearly doesn’t match the package or agreed scope, and can’t be fixed with revisions.</li>
            </ul>
          </Card>
          <Card className="border-brand/40 p-7">
            <h2 className="flex items-center gap-2 font-heading text-xl font-semibold"><Users className="h-5 w-5 text-brand" />Or our agency team finishes it</h2>
            <p className="mt-4 text-sm text-muted">HN is also a full creative agency in Lahore. If a freelancer can’t complete your order, we can offer to have our in-house team finish it at no extra cost — you choose between that and a refund.</p>
          </Card>
          <Card className="p-7">
            <h2 className="flex items-center gap-2 font-heading text-xl font-semibold"><Clock className="h-5 w-5 text-amber-500" />Late delivery credit</h2>
            <p className="mt-4 text-sm text-muted">If your order is delivered after its due date, you automatically receive a {pct(s?.late_compensation_rate ?? 0.1)} credit (as a coupon code) for your next order — no need to ask.</p>
          </Card>
          <Card className="p-7">
            <h2 className="flex items-center gap-2 font-heading text-xl font-semibold"><X className="h-5 w-5 text-red-500" />When the guarantee doesn’t apply</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted [&_li]:ml-5 [&_li]:list-disc">
              <li>Payments made outside HN (directly to a freelancer’s account).</li>
              <li>Orders you approved, or that auto-completed after {s?.auto_complete_days ?? 3} days without a reply.</li>
              <li>Changes in what you want after the work matches the original brief — those are new orders.</li>
              <li>Results that no one can promise, such as a number of sales from ads.</li>
            </ul>
          </Card>
        </div>
        <Card className="mt-8 p-7">
          <h2 className="font-heading text-xl font-semibold">How to claim</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-4">
            {['Open the order in your dashboard', 'Click “Open a dispute” and explain the problem', 'Our team replies within 1 business day', 'Get the work completed or a refund in 5–7 business days'].map((x, i) => (
              <li key={x} className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-navy-900"><span className="font-heading text-2xl font-bold text-brand">{i + 1}</span><p className="mt-1">{x}</p></li>
            ))}
          </ol>
          <p className="mt-5 text-xs text-muted">Full rules: <Link to="/refund-policy" className="text-brand">Refund & cancellation policy</Link> · <Link to="/terms" className="text-brand">Terms</Link>.</p>
        </Card>
        <div className="mt-10 flex flex-wrap justify-center gap-3"><ButtonLink to="/explore" size="lg">Hire with confidence</ButtonLink><ButtonLink to="/trust-safety" size="lg" variant="outline">Trust & safety</ButtonLink></div>
      </section>
    </div>
  );
}

/* ------------------------------ Trust & safety ------------------------------ */
export function TrustSafety() {
  const c = useSiteContact();
  useSeo({ title: 'Trust & Safety – Payment Protection & Verified Freelancers', description: 'How HN protects your money and data: payment held until approval, CNIC-verified freelancers, private files, two-step login and fast dispute support.', path: '/trust-safety' });
  return (
    <div>
      <Hero icon={ShieldCheck} eyebrow="Trust & safety" title="Your payment is safe until you approve the delivery"
        sub="Clear rules, verified people and a real team behind every order — so you can hire without worry." />
      <section className="mx-auto max-w-6xl px-4 sm:px-6"><TrustBar /></section>
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-14 sm:px-6">
        <Card className="p-7">
          <h2 className="flex items-center gap-2 font-heading text-xl font-semibold"><Wallet className="h-5 w-5 text-brand" />Payment protection</h2>
          <div className="mt-4 grid gap-4 text-sm text-muted md:grid-cols-3">
            <p><b className="text-navy dark:text-white">Pay HN, not the freelancer.</b> All payments go to HN Creative Agency’s business accounts shown at checkout — never to a personal number.</p>
            <p><b className="text-navy dark:text-white">Held until approval.</b> The freelancer’s earning is released only after you approve the delivery or the auto-approve period ends.</p>
            <p><b className="text-navy dark:text-white">Every rupee is tracked.</b> Payments, refunds and payouts are recorded in an audit log reviewed by our finance team.</p>
          </div>
        </Card>
        <Card id="verification" className="scroll-mt-24 p-7">
          <h2 className="flex items-center gap-2 font-heading text-xl font-semibold"><BadgeCheck className="h-5 w-5 text-brand" />How freelancers get verified</h2>
          <ol className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <li className="rounded-xl bg-slate-50 p-4 dark:bg-navy-900"><b>1. Identity</b><p className="mt-1 text-muted">A photo of their CNIC (stored privately, seen only by our verification team) and their legal name.</p></li>
            <li className="rounded-xl bg-slate-50 p-4 dark:bg-navy-900"><b>2. Work samples</b><p className="mt-1 text-muted">Links to previous work that we check for originality and quality.</p></li>
            <li className="rounded-xl bg-slate-50 p-4 dark:bg-navy-900"><b>3. Badge</b><p className="mt-1 text-muted">Approved freelancers get the <BadgeCheck className="inline h-4 w-4 text-brand" /> badge on their profile and gigs.</p></li>
          </ol>
          <p className="mt-4 text-sm text-muted">Freelancers also earn levels from real results: <b>Rising Seller</b> <TrendingUp className="inline h-4 w-4 text-sky-500" /> after 5 completed orders with good ratings, and <b>Top Seller</b> <Award className="inline h-4 w-4 text-amber-500" /> after 25 orders with 4.7★ or more.</p>
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-7">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Eye className="h-5 w-5 text-brand" />Privacy</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted [&_li]:ml-5 [&_li]:list-disc">
              <li>Your phone and email are never shown publicly.</li>
              <li>Chat files, deliveries and payment receipts are private and shared only with the people in the order.</li>
              <li>We never ask for your PIN, OTP, card number or banking password.</li>
            </ul>
          </Card>
          <Card className="p-7">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><KeyRound className="h-5 w-5 text-brand" />Account security</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted [&_li]:ml-5 [&_li]:list-disc">
              <li>Turn on two-step login (authenticator app) in Account settings.</li>
              <li>Built-in limits stop spam, fake sign-ups and message flooding.</li>
              <li>Passwords are never stored in plain text and all traffic is encrypted (HTTPS).</li>
            </ul>
          </Card>
          <Card className="p-7">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><MessageSquare className="h-5 w-5 text-brand" />Keep it on HN</h2>
            <p className="mt-3 text-sm text-muted">Talk, share files and pay through HN. If anyone asks you to pay outside the platform or share contact details to avoid fees, please report it — off-platform payments aren’t protected.</p>
          </Card>
          <Card className="p-7">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Flag className="h-5 w-5 text-brand" />Report a problem</h2>
            <p className="mt-3 text-sm text-muted">Use “Report” on any gig, profile, review or message. Every report is reviewed by a person. For urgent issues message us on <a href={c.whatsappUrl} className="font-medium text-brand">WhatsApp</a>.</p>
          </Card>
        </div>
        <div className={cn('flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300')}>
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>HN never contacts you from a personal number asking for payment. Our only payment accounts are the ones shown on the checkout page of your order.</p>
        </div>
      </section>
    </div>
  );
}
