import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Search, MessageSquare, Wallet, CheckCircle2, PenTool, Send, Banknote, ShieldCheck, Star, Building2, MapPin, Users, RotateCcw } from 'lucide-react';
import { ButtonLink, Card, LegacyImg } from '@/components/ui';
import { TrustBar } from '@/components/marketing';
import { cn } from '@/lib/utils';
import { useSeo, orgJsonLd } from '@/lib/seo';
import { useSiteContact } from '@/lib/site';
import { usePublicSettings } from '@/lib/hooks';

function Doc({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-heading text-4xl font-semibold text-navy dark:text-white">{title}</h1>
      {updated && <p className="mt-2 text-sm text-muted">Last updated: {updated}</p>}
      <div className="prose-hn mt-8 space-y-5 leading-relaxed text-navy/80 dark:text-slate-300 [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-navy dark:[&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </div>
  );
}

export function About() {
  const s = usePublicSettings();
  const c = useSiteContact();
  const co = s?.company_info;
  const hasCo = !!(co && (co.legal_name || co.registration || co.ntn));
  useSeo({ title: 'About Us – A Lahore Creative Agency Building Pakistan’s Freelance Marketplace', description: 'HN Creative Agency is a Lahore-based creative agency. Our marketplace lets Pakistani businesses hire verified freelancers with local payments and a money-back guarantee.', path: '/about', jsonLd: orgJsonLd() });
  return (
    <div>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <span className="text-sm font-semibold uppercase tracking-wider text-brand">About us</span>
          <h1 className="mt-2 font-heading text-4xl font-semibold text-navy dark:text-white">A creative agency that opened its doors to independent talent</h1>
          <p className="mt-4 leading-relaxed text-muted">HN Creative Agency started as a full-service digital agency in Lahore, helping brands establish a strong online presence through strategic design, development, branding, and marketing.</p>
          <p className="mt-3 leading-relaxed text-muted">The marketplace extends that mission for Pakistan: clients hire skilled freelancers directly with clear PKR packages, low fees, real reviews, local payments (JazzCash, Easypaisa, Raast, bank transfer) and a simple promise — work done or your money back. Our agency team stays available for fully managed projects and as a backup when a freelancer can’t finish.</p>
          <div className="mt-6 flex gap-3"><ButtonLink to="/explore">Explore services</ButtonLink><ButtonLink to="/agency" variant="outline">Meet the agency</ButtonLink></div>
        </div>
        <LegacyImg src="/assets/images/image.png" alt="Haseeb Noor, CEO & Founder" className="mx-auto aspect-square w-full max-w-sm rounded-3xl object-cover shadow-card" />
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-10 sm:px-6 md:grid-cols-3">
        {[
          { i: ShieldCheck, t: 'Honest by design', d: 'No fake reviews, ratings or sales counts. Every number on the platform comes from real orders.' },
          { i: Banknote, t: 'Protected payments', d: 'Your payment is held until you approve the delivery. Every rupee follows an auditable ledger.' },
          { i: Star, t: 'Quality first', d: 'New gigs are reviewed by our team, and freelancers earn a verified badge after a CNIC and work check.' },
        ].map((v) => (
          <Card key={v.t} className="p-6"><v.i className="h-6 w-6 text-brand" /><h3 className="mt-3 font-heading font-semibold">{v.t}</h3><p className="mt-1.5 text-sm text-muted">{v.d}</p></Card>
        ))}
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6"><TrustBar compact /></section>
      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-10 sm:px-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Users className="h-5 w-5 text-brand" />Our team</h2>
          <div className="mt-4 flex items-center gap-4">
            <LegacyImg src="/assets/images/image.png" alt="Haseeb Noor" className="h-16 w-16 rounded-2xl object-cover" />
            <div><p className="font-semibold">Haseeb Noor</p><p className="text-sm text-muted">CEO & Founder</p></div>
          </div>
          <p className="mt-4 text-sm text-muted">Our in-house designers, developers and marketers work from Lahore. Team photos are added here as members join the agency.</p>
        </Card>
        <Card className="p-6">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Building2 className="h-5 w-5 text-brand" />Company details</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {hasCo && co!.legal_name && <div className="flex justify-between gap-4"><dt className="text-muted">Registered name</dt><dd className="text-right font-medium">{co!.legal_name}</dd></div>}
            {hasCo && co!.registration && <div className="flex justify-between gap-4"><dt className="text-muted">Registration no.</dt><dd className="text-right font-medium">{co!.registration}</dd></div>}
            {hasCo && co!.ntn && <div className="flex justify-between gap-4"><dt className="text-muted">NTN</dt><dd className="text-right font-medium">{co!.ntn}</dd></div>}
            <div className="flex justify-between gap-4"><dt className="text-muted">Address</dt><dd className="flex items-start gap-1 text-right font-medium"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{co?.address || c.address}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Email</dt><dd className="text-right font-medium"><a href={`mailto:${c.email}`} className="hover:text-brand">{c.email}</a></dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">WhatsApp</dt><dd className="text-right font-medium"><a href={c.whatsappUrl} className="hover:text-brand">{c.phone}</a></dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Serving</dt><dd className="text-right font-medium">Pakistan · prices in PKR</dd></div>
          </dl>
        </Card>
      </section>
    </div>
  );
}

export function HowItWorks() {
  const [tab, setTab] = useState<'client' | 'freelancer'>('client');
  useSeo({ title: 'How It Works – Hire or Sell Safely', description: 'How hiring and selling works on HN: find a freelancer, pay safely with JazzCash, Easypaisa or bank transfer, approve the delivery — or get your money back.', path: '/how-it-works' });
  const steps = tab === 'client' ? [
    { i: Search, t: 'Find a service or freelancer', d: 'Search by keyword, filter by category, price, rating and delivery time, and compare packages.' },
    { i: MessageSquare, t: 'Talk before you buy', d: 'Message the freelancer, share files and voice notes, or start an audio/video call. Ask for a custom offer if no package fits.' },
    { i: Wallet, t: 'Pay safely', d: 'Pay with JazzCash, Easypaisa, Raast or bank transfer (or instantly online where available). Your money is held by HN — the freelancer is paid only after you approve.' },
    { i: CheckCircle2, t: 'Review, revise, approve', d: 'Request revisions within your package limit. When you are happy, approve the delivery and leave a review. If it goes wrong, our money-back guarantee applies.' },
  ] : [
    { i: PenTool, t: 'Build your profile', d: 'Add your title, skills, experience, languages and portfolio. A complete profile ranks better.' },
    { i: Send, t: 'Publish gigs & send proposals', d: 'Create Basic, Standard and Premium packages in PKR, or reply to client requests with a proposal. Our team reviews new gigs for quality.' },
    { i: MessageSquare, t: 'Deliver great work', d: 'Accept orders, chat with clients, upload deliveries and handle revisions — all tracked on the order timeline.' },
    { i: Banknote, t: 'Get paid', d: 'Completed-order earnings clear after the clearance period, then withdraw to JazzCash, Easypaisa, Raast or your bank. You always see the expected payment date.' },
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <h1 className="font-heading text-4xl font-semibold text-navy dark:text-white">How it works</h1>
        <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1 dark:bg-navy-800">
          {(['client', 'freelancer'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn('rounded-lg px-5 py-2 text-sm font-medium capitalize transition', tab === t ? 'bg-white text-brand shadow dark:bg-navy-700' : 'text-muted')}>For {t}s</button>
          ))}
        </div>
      </div>
      <div className="mt-10 space-y-4">
        {steps.map((s, i) => (
          <Card key={s.t} className="flex gap-5 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand/15"><s.i className="h-6 w-6 text-brand" /></div>
            <div><p className="text-xs font-semibold text-brand">Step {i + 1}</p><h3 className="font-heading text-lg font-semibold">{s.t}</h3><p className="mt-1 text-muted">{s.d}</p></div>
          </Card>
        ))}
      </div>
      <Card className="mt-10 p-6">
        <h2 className="font-heading text-lg font-semibold">Order statuses explained</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {[
            ['Pending payment', 'Order created; waiting for the client to pay.'], ['Pending acceptance', 'Paid; the freelancer needs to accept the order.'],
            ['Active', 'Work is in progress; the delivery countdown is running.'], ['Delivered', 'The freelancer submitted work for the client to review.'],
            ['Revision requested', 'The client asked for changes (within the package limit).'], ['Completed', 'Delivery approved; earnings move to the freelancer’s pending balance.'],
            ['Disputed', 'Our team is reviewing a problem with the order.'], ['Cancelled / Refunded', 'The order was stopped; any payment is refunded.'],
          ].map(([t, d]) => <div key={t}><dt className="font-medium text-navy dark:text-white">{t}</dt><dd className="text-muted">{d}</dd></div>)}
        </dl>
      </Card>
      <div className="mt-10 flex justify-center gap-3"><ButtonLink to="/register">Create an account</ButtonLink><ButtonLink to="/help" variant="outline">Read the FAQs</ButtonLink></div>
    </div>
  );
}

const FAQS: [string, string][] = [
  ['How do payments work?', 'At checkout you pay the package price (plus a small service fee only on orders above PKR 5,000). Pay with JazzCash, Easypaisa, Raast or bank transfer — or instantly online where available. Transfers are confirmed by our team, usually within a few business hours, and then your order starts.'],
  ['Is my money safe?', 'Yes. Your payment is safe until you approve the delivery. HN holds it in our business account and releases the freelancer’s earning only after you approve the work (or after the auto-approve period if you don’t reply). If the work isn’t delivered as agreed, you get a refund under our money-back guarantee.'],
  ['What is the money-back guarantee?', 'If a freelancer declines, doesn’t deliver, or delivers work that doesn’t match the agreed package, open a dispute. Our team will either get the work completed — sometimes by our own agency team — or refund you. Late deliveries also earn you an automatic credit.'],
  ['How long does payment verification take?', 'Usually within a few business hours. If the reference cannot be matched, the payment is marked rejected with a reason and you can resubmit.'],
  ['What if I am not happy with the delivery?', 'Request a revision within your package’s revision limit. If you still cannot agree with the freelancer, open a dispute from the order page and our team will review the case.'],
  ['When do freelancers get paid?', 'When an order is completed, the earning (price minus commission) goes to the freelancer’s pending balance. After the clearance period it becomes available to withdraw. The wallet shows the release date and the expected payment date for each withdrawal.'],
  ['What are the fees?', 'Freelancers pay 10% commission (less for Rising and Top Sellers, and 0% for Founding Freelancers during the offer). Clients pay no service fee on orders up to PKR 5,000 and 3% above. See the Pricing & Fees page for examples.'],
  ['Can I post a job instead of searching?', 'Yes. Use “Post a request” to describe what you need. Freelancers send proposals with a price and timeline, and you hire the one you like.'],
  ['Can I talk to a freelancer before ordering?', 'Yes. Use “Contact” on any gig or profile to chat, share files, send voice notes or start an audio/video call. You can also send a custom project request.'],
  ['Can I pay a freelancer outside the platform?', 'Please don’t. Off-platform payments are not protected, cannot be refunded by us, and break our Terms. Report any such request.'],
  ['How do I become a verified freelancer?', 'Go to Settings → Verification, upload a photo of your CNIC and add links to your work. Our team reviews it within 2 business days and adds the verified badge.'],
  ['Do you support Urdu?', 'Yes. Our support team replies in Urdu or English on WhatsApp, and you can switch the main pages to Urdu with the language button at the top.'],
];

export function Help() {
  const [open, setOpen] = useState<number | null>(0);
  useSeo({ title: 'Help Center – Payments, Orders, Fees & Refunds', description: 'Answers about payments, the money-back guarantee, fees, payouts and verification on HN Creative Agency.', path: '/help',
    jsonLd: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) } });
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-center font-heading text-4xl font-semibold text-navy dark:text-white">Help center</h1>
      <p className="mt-3 text-center text-muted">Answers to the most common questions about orders, payments and payouts.</p>
      <div className="mt-10 space-y-3">
        {FAQS.map(([q, a], i) => (
          <Card key={q} className="overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 p-5 text-left font-medium" aria-expanded={open === i}>
              {q}<ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition', open === i && 'rotate-180')} />
            </button>
            {open === i && <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{a}</p>}
          </Card>
        ))}
      </div>
      <Card className="mt-10 p-6 text-center">
        <p className="font-heading font-semibold">Still need help?</p>
        <p className="mt-1 text-sm text-muted">Message us on WhatsApp (Urdu or English) or send a message — we reply within one business day.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2"><ButtonLink to="/contact">Contact support</ButtonLink><ButtonLink to="/guarantee" variant="outline"><RotateCcw className="h-4 w-4" />Money-back guarantee</ButtonLink></div>
      </Card>
    </div>
  );
}

const UPDATED = '23 October 2026';
// Note for the owner: have these policies reviewed by a qualified lawyer in Pakistan, especially the
// "Payment protection" wording (section 4) and the money-back guarantee.

export function Terms() {
  const c = useSiteContact();
  useSeo({ title: 'Terms & Conditions', path: '/terms' });
  return (
    <Doc title="Terms & Conditions" updated={UPDATED}>
      <p>These terms govern your use of the HN Creative Agency marketplace ("Platform"), operated by HN Creative Agency, Lahore, Pakistan. By creating an account you agree to them.</p>
      <h2>1. Accounts</h2>
      <ul><li>You must provide accurate information and keep your password secure.</li><li>Each person may hold one account. You may register as a client or a freelancer.</li><li>We may suspend accounts that break these terms, including attempts at fraud or off-platform payment.</li></ul>
      <h2>2. Orders</h2>
      <ul><li>An order is a contract between the client and the freelancer for the package or custom offer described.</li><li>An order starts only after payment has been verified.</li><li>Freelancers must deliver within the agreed time and provide revisions up to the package limit.</li><li>Delivered orders are automatically completed if the client does not respond within the period shown on the order.</li></ul>
      <h2>3. Fees</h2>
      <ul><li>Clients pay a service fee shown at checkout (currently none on orders up to PKR 5,000). Coupons reduce the client’s payment and do not reduce the freelancer’s earning.</li><li>Freelancers pay a platform commission deducted from each completed order. Current rates are shown on the Pricing & Fees page, at checkout and in the freelancer wallet.</li></ul>
      <h2>4. Payment protection and payouts</h2>
      <ul><li>All payments are made to HN Creative Agency, which holds the amount on the client’s behalf until the order is completed. Your payment stays protected until you approve the delivery (or the auto-complete period ends without a response).</li><li>If an order is cancelled, declined or resolved in the client’s favour, the client is refunded as described in the Refund Policy and the Money-Back Guarantee.</li><li>Freelancer earnings become withdrawable after a clearance period and are paid to the payout method on file within the time shown in the wallet.</li><li>All payments must go through the Platform. Payments made outside the Platform are not protected.</li></ul>
      <h2>5. Content and intellectual property</h2>
      <ul><li>Unless agreed otherwise, ownership of final deliverables transfers to the client once the order is completed and paid.</li><li>Freelancers must only deliver work they have the right to use.</li></ul>
      <h2>6. Disputes</h2>
      <p>Either party may open a dispute on a paid, in-progress order. Our team reviews the order history and messages and may resume the order, have it completed by HN’s agency team, complete it, or cancel and refund it. Our decision on the Platform is final, without limiting your legal rights.</p>
      <h2>7. Prohibited use</h2>
      <ul><li>Illegal, misleading, hateful or adult content.</li><li>Harassment, spam, or sharing contact details to avoid fees.</li><li>Fake reviews or manipulation of ratings.</li></ul>
      <h2>8. Contact</h2>
      <p>{c.email} · {c.phone}</p>
    </Doc>
  );
}

export function Privacy() {
  const c = useSiteContact();
  useSeo({ title: 'Privacy Policy', path: '/privacy' });
  return (
    <Doc title="Privacy Policy" updated={UPDATED}>
      <h2>What we collect</h2>
      <ul><li>Account data: name, email, role, and profile information you add.</li><li>Order data: messages, files, deliveries, reviews and the order timeline.</li><li>Payment data: transaction references, proof-of-payment files and payout details (account title and number). Card payments, where available, are processed on our payment partner’s secure page — we never see or store card numbers, PINs, CVV codes or online-banking passwords.</li><li>Verification data (freelancers who apply): legal name and CNIC photos, stored privately and visible only to our verification team.</li><li>Technical data: last-seen time, call metadata (start, end, duration) and, if enabled, anonymous analytics (Google Analytics, Meta Pixel) to improve the site. Calls are peer-to-peer and are not recorded.</li></ul>
      <h2>How we use it</h2>
      <ul><li>To run orders, messaging, calls and payments.</li><li>To prevent fraud and resolve disputes.</li><li>To send notifications you can control in Settings.</li></ul>
      <h2>Who can see it</h2>
      <ul><li>Public profiles, gigs and reviews are visible to everyone.</li><li>Messages and order files are visible only to the people in that conversation or order, and to our administrators when needed to resolve a dispute or report.</li><li>Payout details are visible only to you and authorised administrators.</li><li>Your email and phone number are never shown publicly.</li></ul>
      <h2>Your choices</h2>
      <ul><li>Hide your online status in Settings.</li><li>Request a copy or deletion of your data by emailing {c.email}. Some financial records must be kept for legal and accounting reasons.</li></ul>
    </Doc>
  );
}

export function RefundPolicy() {
  useSeo({ title: 'Refund & Cancellation Policy', path: '/refund-policy' });
  return (
    <Doc title="Refund & Cancellation Policy" updated={UPDATED}>
      <p>This policy works together with our <Link to="/guarantee" className="text-brand">Money-Back Guarantee</Link>: work done, or your money back.</p>
      <h2>Before payment</h2>
      <p>Either party can cancel an unpaid order at any time from the order page.</p>
      <h2>After payment</h2>
      <ul><li>If the freelancer declines the order, it is cancelled and a full refund is issued.</li><li>If work is not delivered, is late, or does not match the agreed scope, open a dispute from the order page.</li><li>Our team reviews the case and may resume the order, have HN’s agency team complete it at no extra cost, or cancel it with a full or partial refund.</li><li>If an order is delivered after its due date, the client automatically receives a credit for a future order.</li></ul>
      <h2>After completion</h2>
      <p>Completed orders are not refundable, because the client has approved the delivery (or did not respond within the auto-complete period).</p>
      <h2>How refunds are paid</h2>
      <p>Refunds are sent back to the account or wallet the payment came from (bank, JazzCash, Easypaisa or Raast), usually within 5–7 business days after approval. You will see the refund reference on the order.</p>
    </Doc>
  );
}

export function NotFound() {
  useSeo({ title: 'Page not found', noindex: true });
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-heading text-6xl font-bold text-brand">404</p>
      <h1 className="mt-4 font-heading text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">The page you are looking for doesn't exist or has moved.</p>
      <div className="mt-6 flex justify-center gap-3"><ButtonLink to="/">Go home</ButtonLink><Link to="/explore" className="inline-flex h-10 items-center px-4 text-sm font-medium text-brand">Explore gigs</Link></div>
    </div>
  );
}
