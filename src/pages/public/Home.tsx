import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight, ShieldCheck, MessageSquare, Wallet, Sparkles, CheckCircle2, Briefcase, Users, FileText,
  PenTool, Gem, Clapperboard, Film, Share2, Megaphone, MonitorSmartphone, ShoppingBag, Image, RotateCcw, Zap, Percent, BadgeCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAsync, useCategories, useFavorites, usePublicSettings, q } from '@/lib/hooks';
import type { Gig } from '@/lib/types';
import { GigCard } from '@/components/cards';
import { ButtonLink, Card, LegacyImg, Skeleton } from '@/components/ui';
import { SectionTitle, TrustBar } from '@/components/marketing';
import { useLang } from '@/context/LangContext';
import { useSeo, orgJsonLd } from '@/lib/seo';
import { track } from '@/lib/analytics';
import { SERVICES, AGENCY_PLANS } from '@/content/services';
import { STUDIO_WORK } from '@/content/caseStudies';
import type { BlogPost } from '@/content/blog';
import { cn, money, date } from '@/lib/utils';
import { pct } from '@/lib/fees';

export const GIG_SELECT = '*, freelancer:profiles!gigs_freelancer_id_fkey(id,full_name,avatar_url,title,is_verified,availability,rating_avg,rating_count,seller_level,founding_until), category:categories!gigs_category_id_fkey(name,slug)';

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const map: Record<string, React.ComponentType<{ className?: string }>> = { PenTool, Gem, Clapperboard, Film, Share2, Megaphone, MonitorSmartphone, ShoppingBag, Sparkles, Image };
  const I = (name && map[name]) || Sparkles;
  return <I className={className} />;
}

export default function Home() {
  const nav = useNavigate();
  const { t, isUr } = useLang();
  const s = usePublicSettings();
  const [term, setTerm] = useState('');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  useEffect(() => { import('@/content/blog').then((m) => setPosts(m.POSTS.slice(0, 3))).catch(() => null); }, []);
  const { parents } = useCategories();
  const fav = useFavorites();
  const gigs = useAsync(() => q(supabase.from('gigs').select(GIG_SELECT).eq('status', 'published').order('seller_rank', { ascending: false }).order('published_at', { ascending: false }).limit(8)) as Promise<Gig[]>, []);
  const counts = useAsync(async () => {
    const [g, f] = await Promise.all([
      supabase.from('gigs').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'freelancer').eq('status', 'active').eq('profile_completed', true),
    ]);
    return { gigs: g.count ?? 0, freelancers: f.count ?? 0 };
  }, []);
  useSeo({
    title: 'Pakistan’s Affordable & Safe Freelance Marketplace',
    description: 'Hire verified Pakistani freelancers for logos, websites, video editing, social media and ads. Pay with JazzCash, Easypaisa or bank transfer. Work done or your money back.',
    path: '/', jsonLd: [orgJsonLd(), { '@context': 'https://schema.org', '@type': 'WebSite', name: 'HN Creative Agency', url: 'https://hncreativeagency.pages.dev', potentialAction: { '@type': 'SearchAction', target: 'https://hncreativeagency.pages.dev/explore?q={query}', 'query-input': 'required name=query' } }],
  });

  const threshold = s?.client_fee_free_threshold ?? 5000;
  const commission = s?.commission_rate ?? 0.1;
  const ur = isUr ? 'font-urdu leading-[1.9]' : '';
  const dir = isUr ? 'rtl' as const : undefined;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white dark:from-navy-950 dark:via-navy-900 dark:to-navy-900">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand/20 blur-3xl dark:bg-brand/10" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div dir={dir}>
            <span className={cn('inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-brand shadow-sm dark:bg-navy-800', ur)}>
              <Sparkles className="h-3.5 w-3.5" />{t('hero.badge')}
            </span>
            <h1 className={cn('mt-5 font-heading text-4xl font-bold leading-tight text-navy dark:text-white sm:text-5xl lg:text-[54px]', ur)}>
              {t('hero.title1')} <span className="text-brand">{t('hero.title2')}</span>
            </h1>
            <p className={cn('mt-5 max-w-xl text-lg leading-relaxed text-muted', ur)}>{t('hero.sub')}</p>
            <form onSubmit={(e) => { e.preventDefault(); if (term) track('search', { search_term: term }); nav(`/explore${term ? `?q=${encodeURIComponent(term)}` : ''}`); }}
              className="mt-7 flex max-w-xl items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card dark:border-navy-700 dark:bg-navy-800" dir="ltr">
              <Search className="ml-2 h-5 w-5 shrink-0 text-muted" />
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('hero.search')} aria-label="Search services"
                className={cn('h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400', isUr && 'font-urdu')} />
              <button className={cn('h-10 rounded-xl bg-brand px-5 text-sm font-medium text-white hover:bg-brand-600', isUr && 'font-urdu')}>{t('hero.searchBtn')}</button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className={ur}>{t('hero.popular')}</span>
              {['Logo Design', 'Reels & Shorts', 'Meta Ads', 'Shopify', 'Landing Pages'].map((x) => (
                <Link key={x} to={`/explore?q=${encodeURIComponent(x)}`} className="rounded-full border border-slate-200 px-3 py-0.5 hover:border-brand hover:text-brand dark:border-navy-700">{x}</Link>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-navy dark:text-slate-200">
              <span className="flex items-center gap-1.5"><Percent className="h-4 w-4 text-emerald-500" /><span className={ur}>{isUr ? t('hero.fee') : `No service fee up to ${money(threshold)}`}</span></span>
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-emerald-500" />JazzCash · Easypaisa · Raast</span>
              <span className="flex items-center gap-1.5"><RotateCcw className="h-4 w-4 text-emerald-500" />Money-back guarantee</span>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              {STUDIO_WORK.slice(0, 4).map(({ n, t: label }) => (
                <LegacyImg key={n} src={`/project-${n}.jpg`} alt={label} className={`aspect-[4/3] w-full rounded-2xl object-cover shadow-card ${n % 2 === 0 ? 'translate-y-8' : ''}`} />
              ))}
            </div>
            <Card className="absolute -bottom-6 left-6 flex items-center gap-3 p-3">
              <ShieldCheck className="h-8 w-8 text-emerald-500" />
              <div><p className="text-sm font-semibold">Payment protected</p><p className="text-xs text-muted">Released only when you approve the work</p></div>
            </Card>
            <Card className="absolute -top-4 right-4 flex items-center gap-3 p-3">
              <Gem className="h-7 w-7 text-brand" />
              <div><p className="text-sm font-semibold">Logos from {money(3000)}</p><p className="text-xs text-muted">Clear packages · PKR pricing</p></div>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6"><TrustBar /></section>

      {/* Two businesses, clearly separated */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionTitle title={<span className={ur} dir={dir}>{t('paths.title')}</span>} />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {[
            { i: Users, title: t('paths.freelancer'), d: t('paths.freelancerD'), cta: t('cta.browse'), to: '/explore', tone: 'bg-brand text-white', points: ['Packages from PKR 500', 'Chat, voice notes & calls', 'Pay only when you approve'] },
            { i: Briefcase, title: t('paths.agency'), d: t('paths.agencyD'), cta: t('cta.agency'), to: '/agency#pricing', tone: 'bg-navy text-white dark:bg-white dark:text-navy', points: ['Starter from PKR 3,000', 'Dedicated project manager', 'Quality guaranteed by HN'] },
            { i: FileText, title: t('paths.request'), d: t('paths.requestD'), cta: t('cta.post'), to: '/post-request', tone: 'bg-emerald-600 text-white', points: ['Free to post', 'Compare proposals & prices', 'Hire in one click'] },
          ].map((c) => (
            <Card key={c.to} className="flex flex-col p-7">
              <span className={cn('inline-flex h-12 w-12 items-center justify-center rounded-2xl', c.tone)}><c.i className="h-6 w-6" /></span>
              <h3 className={cn('mt-5 font-heading text-xl font-semibold text-navy dark:text-white', ur)} dir={dir}>{c.title}</h3>
              <p className={cn('mt-2 text-sm leading-relaxed text-muted', ur)} dir={dir}>{c.d}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">{c.points.map((p) => <li key={p} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{p}</li>)}</ul>
              <ButtonLink to={c.to} variant="outline" className={cn('mt-6', ur)}>{c.cta}<ArrowRight className="h-4 w-4" /></ButtonLink>
            </Card>
          ))}
        </div>
      </section>

      {/* Popular services with PKR starting prices */}
      <section className="bg-surface py-16 dark:bg-navy-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-semibold text-navy dark:text-white sm:text-3xl">Popular services</h2>
              <p className="mt-1 text-muted">Clear starting prices in PKR — no surprises at checkout.</p>
            </div>
            <Link to="/services" className="hidden items-center gap-1 text-sm font-medium text-brand sm:flex">All services<ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {SERVICES.map((sv) => (
              <Link key={sv.slug} to={`/services/${sv.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lift dark:border-navy-700 dark:bg-navy-800">
                <CategoryIcon name={sv.icon} className="h-7 w-7 text-brand transition group-hover:scale-110" />
                <p className="mt-3 font-semibold text-navy dark:text-white">{sv.name}</p>
                <p className="text-xs text-muted">{sv.short}</p>
                <p className="mt-3 text-sm">from <b className="text-navy dark:text-white">{money(sv.tiers[0].price)}</b>{sv.monthly && <span className="text-muted">/mo</span>}</p>
              </Link>
            ))}
          </div>
          {parents.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {parents.map((c) => (
                <Link key={c.id} to={`/explore?category=${c.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm hover:border-brand hover:text-brand dark:border-navy-700 dark:bg-navy-800">
                  <CategoryIcon name={c.icon} className="h-4 w-4 text-brand" />{c.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Latest gigs */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-navy dark:text-white sm:text-3xl">Fresh on the marketplace</h2>
            <p className="mt-1 text-muted">{counts.data && counts.data.gigs > 0 ? `${counts.data.gigs} live services from ${counts.data.freelancers} freelancers` : 'Newest published services'}</p>
          </div>
          <Link to="/explore" className="hidden items-center gap-1 text-sm font-medium text-brand sm:flex">See all<ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {gigs.loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
          {gigs.data?.map((g) => <GigCard key={g.id} gig={g} favorite={fav.ids.has(g.id)} onToggleFavorite={() => fav.toggle(g.id)} />)}
        </div>
        {!gigs.loading && !gigs.data?.length && (
          <Card className="grid items-center gap-6 p-8 md:grid-cols-[1fr_auto]">
            <div>
              <p className="font-heading text-xl font-semibold">We’re onboarding our first freelancers</p>
              <p className="mt-1 text-muted">Need something done now? Our in-house agency team can start today — or post a request and let freelancers come to you.</p>
            </div>
            <div className="flex flex-wrap gap-2"><ButtonLink to="/post-request">Post a request</ButtonLink><ButtonLink to="/agency#pricing" variant="outline">Hire the agency</ButtonLink></div>
          </Card>
        )}
      </section>

      {/* Fees band */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand to-brand-500 p-8 text-white sm:p-12 lg:grid-cols-2">
          <div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Low, honest fees</span>
            <h2 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Only {pct(commission)} for freelancers. 0% client fee up to {money(threshold)}.</h2>
            <p className="mt-3 max-w-lg text-white/85">No hidden charges. Above {money(threshold)} clients pay a small {pct(s?.client_service_fee_rate ?? 0.03)} service fee. Founding Freelancers pay {pct(s?.founding_program.commission_rate ?? 0)} commission for their first {s?.founding_program.months ?? 3} months.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink to="/pricing" size="lg" className="!bg-white !text-brand-700 hover:!bg-brand-50">See pricing & fees</ButtonLink>
              <ButtonLink to="/register?role=freelancer" size="lg" variant="outline" className="!border-white/40 !bg-transparent !text-white">Start selling</ButtonLink>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-navy">
            {[
              ['Freelancer keeps', `${100 - Math.round(commission * 100)}%`, 'of every order'],
              ['Client fee', '0%', `on orders up to ${money(threshold)}`],
              ['Payouts', 'JazzCash', 'Easypaisa, Raast or bank'],
              ['Support', 'اردو + English', 'on WhatsApp'],
            ].map(([a, b, c]) => (
              <div key={a} className="rounded-2xl bg-white/95 p-5">
                <p className="text-xs font-medium text-muted">{a}</p>
                <p className="mt-1 font-heading text-2xl font-bold">{b}</p>
                <p className="text-xs text-muted">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionTitle title={<span className={ur} dir={dir}>{t('how.title')}</span>} sub="A clear process from first message to final delivery." />
        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {[
            { icon: Search, t: 'Find the right talent', d: 'Compare gigs, portfolios, PKR packages and reviews from real orders — or post a request.' },
            { icon: MessageSquare, t: 'Discuss your project', d: 'Chat, send files and voice notes, or jump on an audio/video call before you pay.' },
            { icon: Wallet, t: 'Pay safely', d: 'Pay with JazzCash, Easypaisa, Raast or bank transfer. We hold the payment until you approve.' },
            { icon: CheckCircle2, t: 'Approve the delivery', d: 'Request revisions within your package, approve, and review. Not delivered? Money back.' },
          ].map((x, i) => (
            <Card key={x.t} className="p-6">
              <div className="flex items-center justify-between">
                <x.icon className="h-6 w-6 text-brand" />
                <span className="font-heading text-3xl font-bold text-slate-200 dark:text-navy-700">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-heading font-semibold text-navy dark:text-white">{x.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{x.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Guarantee */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-8 dark:border-emerald-500/20 dark:bg-emerald-500/5 sm:p-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <ShieldCheck className="h-10 w-10 text-emerald-600" />
            <h2 className="mt-4 font-heading text-3xl font-semibold text-navy dark:text-white">Work done — or your money back</h2>
            <p className="mt-1 font-urdu text-lg text-emerald-700 dark:text-emerald-300" dir="rtl">کام پورا یا پیسے واپس</p>
            <p className="mt-3 text-muted">Because HN is also a full creative agency, we can do something other marketplaces can’t: if a freelancer can’t finish your order, our own team can complete it — or we refund you.</p>
            <ButtonLink to="/guarantee" className="mt-6">How the guarantee works</ButtonLink>
          </div>
          <ol className="space-y-3">
            {[
              ['Your payment is protected', 'The freelancer is paid only after you approve the delivery (or the auto-approve period passes without a reply).'],
              ['Late delivery? You get a credit', `If an order is delivered late, you automatically receive a ${pct(s?.late_compensation_rate ?? 0.1)} credit for your next order.`],
              ['Problem? Open a dispute', 'Our team reviews the order and messages — and gets the work finished by our agency team or refunds you.'],
            ].map(([a, b], i) => (
              <li key={a} className="flex gap-4 rounded-2xl bg-white p-5 dark:bg-navy-800">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{i + 1}</span>
                <div><p className="font-semibold">{a}</p><p className="mt-0.5 text-sm text-muted">{b}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Agency packages */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-brand">Hire the Agency</span>
            <h2 className="mt-1 font-heading text-2xl font-semibold text-navy dark:text-white sm:text-3xl">Prefer one team to handle everything?</h2>
            <p className="mt-1 text-muted">Managed packages by HN’s in-house team — one price in PKR, one project manager.</p>
          </div>
          <Link to="/agency#pricing" className="inline-flex items-center gap-1 text-sm font-medium text-brand">Compare packages<ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AGENCY_PLANS.map((p) => (
            <Card key={p.id} className={cn('flex flex-col p-6', p.hot && 'border-brand ring-2 ring-brand')}>
              <p className="font-heading font-semibold">{p.name}</p>
              <p className="text-xs text-muted">{p.tagline}</p>
              <p className="mt-4 font-heading text-3xl font-bold">{p.price ? money(p.price) : 'Custom'}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">{p.includes.slice(0, 3).map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{x}</li>)}</ul>
              <ButtonLink to={`/agency?plan=${p.id}#pricing`} variant={p.hot ? 'primary' : 'outline'} className="mt-5">{p.price ? 'Choose' : 'Get a quote'}</ButtonLink>
            </Card>
          ))}
        </div>
      </section>

      {/* Founding freelancer */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-navy p-8 text-white dark:bg-navy-800 sm:p-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-200"><Sparkles className="h-3.5 w-3.5" />Founding Freelancer programme</span>
            <h2 className="mt-4 font-heading text-3xl font-semibold">Join early: {pct(s?.founding_program.commission_rate ?? 0)} commission for {s?.founding_program.months ?? 3} months</h2>
            <p className="mt-3 text-slate-300">The first {s?.founding_program.slots ?? 50} freelancers get a permanent Founding Freelancer badge, zero commission while the offer runs, and priority placement while the marketplace grows.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink to="/register?role=freelancer" size="lg">Become a Founding Freelancer</ButtonLink>
              <ButtonLink to="/trust-safety#verification" size="lg" variant="outline" className="!border-white/20 !bg-transparent !text-white">How verification works</ButtonLink>
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            {[[BadgeCheck, 'Verified badge after a quick CNIC + work-sample check'], [Wallet, 'Withdraw to JazzCash, Easypaisa, Raast or any bank'], [Users, 'Get leads from client requests and our agency'], [Sparkles, 'Smart writing help for your gig title and description']].map(([I, x]) => {
              const Icon = I as typeof Wallet;
              return <li key={x as string} className="flex items-center gap-3 rounded-2xl bg-white/5 p-4"><Icon className="h-5 w-5 shrink-0 text-brand-300" />{x as string}</li>;
            })}
          </ul>
        </div>
      </section>

      {/* Blog */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-navy dark:text-white sm:text-3xl">Price guides for Pakistan</h2>
            <p className="mt-1 text-muted">Know what to pay before you hire.</p>
          </div>
          <Link to="/blog" className="hidden items-center gap-1 text-sm font-medium text-brand sm:flex">All articles<ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="group">
              <Card className="h-full p-6 transition group-hover:-translate-y-0.5 group-hover:shadow-lift">
                <p className="text-xs font-medium text-brand">{p.tag} · {p.readMins} min read</p>
                <h3 className="mt-2 font-heading text-lg font-semibold leading-snug text-navy group-hover:text-brand dark:text-white">{p.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-muted">{p.description}</p>
                <p className="mt-4 text-xs text-muted">{date(p.date)}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
