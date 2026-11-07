import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, CalendarDays, Users, ShieldCheck, ClipboardList, MessagesSquare, CheckCircle2, BookOpen, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAsync, useFavorites, q } from '@/lib/hooks';
import type { Gig } from '@/lib/types';
import { ButtonLink, Card, EmptyState, LegacyImg, Skeleton } from '@/components/ui';
import { GigCard } from '@/components/cards';
import { GuaranteeNote, LeadForm, SectionTitle, TierGrid, TrustBar } from '@/components/marketing';
import { useSeo } from '@/lib/seo';
import { SITE } from '@/lib/site';
import { POSTS, postBySlug } from '@/content/blog';
import { SERVICES, serviceBySlug } from '@/content/services';
import { CASE_STUDIES, STUDIO_WORK } from '@/content/caseStudies';
import { cn, date, money } from '@/lib/utils';
import { CategoryIcon, GIG_SELECT } from './Home';
import { NotFound } from './StaticPages';

/* ---------------------------------- Blog ---------------------------------- */
export function Blog() {
  useSeo({ title: 'Blog – Price Guides & Hiring Tips for Pakistan', description: 'Logo design prices, website costs, social media packages and safe hiring tips for Pakistani businesses.', path: '/blog' });
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <SectionTitle eyebrow="HN Blog" title="Price guides & hiring tips for Pakistan" sub="Honest numbers in PKR so you know what to pay before you hire." />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {POSTS.map((p, i) => (
          <Link key={p.slug} to={`/blog/${p.slug}`} className={cn('group', i === 0 && 'md:col-span-2')}>
            <Card className="flex h-full flex-col p-7 transition group-hover:-translate-y-0.5 group-hover:shadow-lift">
              <p className="text-xs font-semibold text-brand">{p.tag}</p>
              <h2 className={cn('mt-2 font-heading font-semibold leading-snug text-navy group-hover:text-brand dark:text-white', i === 0 ? 'text-2xl' : 'text-lg')}>{p.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted">{p.description}</p>
              <p className="mt-4 flex items-center gap-3 text-xs text-muted"><span>{date(p.date)}</span><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{p.readMins} min read</span></p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const post = postBySlug(slug);
  useSeo(post ? {
    title: post.title, description: post.description, path: `/blog/${post.slug}`, type: 'article',
    jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description: post.description, datePublished: post.date, dateModified: post.date,
      author: { '@type': 'Organization', name: SITE.name }, publisher: { '@type': 'Organization', name: SITE.name, logo: { '@type': 'ImageObject', url: `${SITE.url}/assets/images/favicon.png` } },
      mainEntityOfPage: `${SITE.url}/blog/${post.slug}` },
  } : { title: 'Article not found', noindex: true });
  if (!post) return <NotFound />;
  const svc = serviceBySlug(post.service);
  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <nav className="text-sm text-muted"><Link to="/blog" className="hover:text-brand">Blog</Link> / {post.tag}</nav>
      <h1 className="mt-3 font-heading text-3xl font-bold leading-tight text-navy dark:text-white sm:text-4xl">{post.title}</h1>
      <p className="mt-3 flex items-center gap-3 text-sm text-muted"><span>{date(post.date)}</span><span>·</span><span>{post.readMins} min read</span><span>·</span><span>HN Creative Agency</span></p>
      <div className="mt-8 space-y-6 leading-relaxed text-navy/85 dark:text-slate-300">
        {post.sections.map((sec, i) => (
          <section key={i} className="space-y-3">
            {sec.h && <h2 className="pt-2 font-heading text-xl font-semibold text-navy dark:text-white">{sec.h}</h2>}
            {sec.p?.map((t, j) => <p key={j}>{t}</p>)}
            {sec.ul && <ul className="space-y-1.5">{sec.ul.map((t) => <li key={t} className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-brand" /><span>{t}</span></li>)}</ul>}
            {sec.table && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-navy-700">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-slate-50 dark:bg-navy-800"><tr>{sec.table.head.map((h) => <th key={h} className="p-3 text-left font-semibold">{h}</th>)}</tr></thead>
                  <tbody>{sec.table.rows.map((r) => <tr key={r[0]} className="border-t border-slate-100 dark:border-navy-700">{r.map((c, k) => <td key={k} className={cn('p-3', k === 1 && 'whitespace-nowrap font-medium')}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        ))}
        <p className="text-xs text-muted">Prices are typical ranges seen in the Pakistani market in October 2026 and change over time. Always confirm the scope and price before you pay.</p>
      </div>
      {svc && (
        <Card className="mt-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <CategoryIcon name={svc.icon} className="h-10 w-10 text-brand" />
          <div className="flex-1"><p className="font-heading font-semibold">Hire for {svc.name.toLowerCase()} on HN</p><p className="text-sm text-muted">Packages from {money(svc.tiers[0].price)} · payment protected · money-back guarantee</p></div>
          <ButtonLink to={`/services/${svc.slug}`}>See packages</ButtonLink>
        </Card>
      )}
      <h2 className="mt-14 font-heading text-lg font-semibold">More articles</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {more.map((p) => <Link key={p.slug} to={`/blog/${p.slug}`} className="rounded-xl border border-slate-200 p-4 text-sm font-medium hover:border-brand hover:text-brand dark:border-navy-700">{p.title}</Link>)}
      </div>
    </article>
  );
}

/* ------------------------------- Case studies ------------------------------- */
export function CaseStudies() {
  useSeo({ title: 'Case Studies & Portfolio', description: 'Work by HN Creative Agency’s studio team. Detailed case studies are published only with our clients’ permission.', path: '/case-studies' });
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <SectionTitle eyebrow="Our work" title="Case studies & portfolio" sub="Real projects, real results — published only with our clients’ written permission." />
      {CASE_STUDIES.length > 0 ? (
        <div className="mt-12 space-y-8">
          {CASE_STUDIES.map((c) => (
            <Card key={c.slug} className="grid overflow-hidden lg:grid-cols-2">
              <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-navy-900">
                {c.before && <figure className="relative"><LegacyImg src={c.before} alt={`${c.client} before`} className="h-full w-full object-cover" /><figcaption className="absolute left-2 top-2 rounded bg-navy/80 px-2 py-0.5 text-xs text-white">Before</figcaption></figure>}
                <figure className={cn('relative', !c.before && 'col-span-2')}><LegacyImg src={c.after} alt={`${c.client} after`} className="h-full w-full object-cover" /><figcaption className="absolute left-2 top-2 rounded bg-brand px-2 py-0.5 text-xs text-white">After</figcaption></figure>
              </div>
              <div className="p-7">
                <p className="text-xs font-semibold text-brand">{c.service} · {c.year}</p>
                <h2 className="mt-1 font-heading text-2xl font-semibold">{c.title}</h2>
                <p className="mt-1 text-sm text-muted">{c.client}</p>
                <dl className="mt-4 space-y-3 text-sm"><div><dt className="font-semibold">Challenge</dt><dd className="text-muted">{c.challenge}</dd></div><div><dt className="font-semibold">What we did</dt><dd className="text-muted">{c.solution}</dd></div></dl>
                <ul className="mt-4 space-y-1.5">{c.results.map((r) => <li key={r} className="flex gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{r}</li>)}</ul>
                {c.quote && <blockquote className="mt-5 border-l-4 border-brand pl-4 text-sm italic text-muted">“{c.quote}”{c.quoteBy && <span className="mt-1 block not-italic">— {c.quoteBy}</span>}</blockquote>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="mx-auto mt-10 max-w-3xl p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-brand" />
          <p className="mt-3 font-heading text-lg font-semibold">Detailed case studies are on their way</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted">We only publish a case study — with before/after images and results — once the client has approved it. Want your project featured? Ask us about a discount when you book.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3"><ButtonLink to="/book-consultation">Book a free consultation</ButtonLink><ButtonLink to="/agency#pricing" variant="outline">Agency packages</ButtonLink></div>
        </Card>
      )}
      <h2 className="mt-16 text-center font-heading text-2xl font-semibold">Studio samples</h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {STUDIO_WORK.map((p) => (
          <div key={p.n} className="group relative overflow-hidden rounded-2xl">
            <LegacyImg src={`/project-${p.n}.jpg`} alt={`${p.t} sample`} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-navy/90 via-navy/20 to-transparent p-5 text-white">
              <span className="text-xs font-medium text-brand-200">{p.c}</span><h3 className="font-heading text-lg font-semibold">{p.t}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Services --------------------------------- */
export function Services() {
  useSeo({ title: 'Services – Logo, Website, Video, Social Media & Ads in PKR', description: 'Browse popular services with clear PKR starting prices. Hire verified Pakistani freelancers or our in-house agency team.', path: '/services' });
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <SectionTitle eyebrow="Services" title="What can we help you with?" sub="Clear PKR starting prices. Hire a freelancer, post a request, or let our agency manage it." />
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => (
          <Link key={s.slug} to={`/services/${s.slug}`} className="group">
            <Card className="h-full p-6 transition group-hover:-translate-y-0.5 group-hover:shadow-lift">
              <CategoryIcon name={s.icon} className="h-8 w-8 text-brand" />
              <h2 className="mt-4 font-heading text-lg font-semibold group-hover:text-brand">{s.name}</h2>
              <p className="mt-1 text-sm text-muted">{s.short}</p>
              <p className="mt-4 text-sm">From <b>{money(s.tiers[0].price)}</b>{s.monthly && '/month'}</p>
            </Card>
          </Link>
        ))}
        <Link to="/explore" className="group">
          <Card className="flex h-full flex-col justify-center border-dashed p-6 text-center transition group-hover:border-brand">
            <p className="font-heading font-semibold">All categories</p><p className="mt-1 text-sm text-muted">Motion graphics, AI video, product ads and more</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export function ServicePage() {
  const { slug } = useParams();
  const svc = serviceBySlug(slug);
  const fav = useFavorites();
  const [open, setOpen] = useState<number | null>(0);
  const gigs = useAsync(async () => {
    if (!svc) return [] as Gig[];
    const cat = await q(supabase.from('categories').select('id').eq('slug', svc.category).maybeSingle()) as { id: string } | null;
    if (!cat) return [] as Gig[];
    return q(supabase.from('gigs').select(GIG_SELECT).eq('status', 'published').eq('category_id', cat.id).order('seller_rank', { ascending: false }).order('rating_avg', { ascending: false }).limit(8)) as Promise<Gig[]>;
  }, [slug]);
  useSeo(svc ? {
    title: svc.title, description: svc.description, path: `/services/${svc.slug}`,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'Service', name: svc.name, areaServed: 'PK', provider: { '@type': 'Organization', name: SITE.name, url: SITE.url },
        offers: svc.tiers.map((t) => ({ '@type': 'Offer', name: t.name, price: t.price, priceCurrency: 'PKR', description: t.includes })) },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: svc.faqs.map(([q1, a]) => ({ '@type': 'Question', name: q1, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  } : { title: 'Service not found', noindex: true });
  if (!svc) return <NotFound />;
  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-white dark:from-navy-950 dark:to-navy-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <nav className="text-sm text-muted"><Link to="/services" className="hover:text-brand">Services</Link> / {svc.name}</nav>
            <h1 className="mt-3 font-heading text-4xl font-bold text-navy dark:text-white">{svc.name} in Pakistan</h1>
            {svc.intro.map((p) => <p key={p} className="mt-4 text-lg leading-relaxed text-muted">{p}</p>)}
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink to={`/explore?category=${svc.category}`} size="lg">Browse {svc.name.toLowerCase()} gigs<ArrowRight className="h-4 w-4" /></ButtonLink>
              <ButtonLink to="/post-request" size="lg" variant="outline">Post a request</ButtonLink>
            </div>
          </div>
          <Card className="self-start p-6">
            <p className="font-heading font-semibold">What you get</p>
            <ul className="mt-3 space-y-2 text-sm">{svc.deliverables.map((d) => <li key={d} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{d}</li>)}</ul>
            <GuaranteeNote className="mt-5" />
          </Card>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="font-heading text-2xl font-semibold">Price guide</h2>
        <p className="mt-1 mb-6 text-sm text-muted">Typical HN packages. {svc.marketNote}</p>
        <TierGrid tiers={svc.tiers} monthly={svc.monthly} />
      </section>
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h2 className="font-heading text-2xl font-semibold">Top {svc.name.toLowerCase()} freelancers</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {gigs.loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
          {gigs.data?.map((g) => <GigCard key={g.id} gig={g} favorite={fav.ids.has(g.id)} onToggleFavorite={() => fav.toggle(g.id)} />)}
        </div>
        {!gigs.loading && !gigs.data?.length && (
          <EmptyState icon={Users} title="New freelancers are joining" text="Post a request and get proposals, or let our agency team handle it for you."
            action={<div className="flex flex-wrap justify-center gap-2"><ButtonLink to="/post-request">Post a request</ButtonLink><ButtonLink to="/agency#pricing" variant="outline">Hire the agency</ButtonLink></div>} />
        )}
      </section>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="text-center font-heading text-2xl font-semibold">Frequently asked questions</h2>
        <div className="mt-6 space-y-3">
          {svc.faqs.map(([qq, a], i) => (
            <Card key={qq} className="overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 p-5 text-left font-medium" aria-expanded={open === i}>
                {qq}<ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition', open === i && 'rotate-180')} />
              </button>
              {open === i && <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{a}</p>}
            </Card>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6"><TrustBar compact /></section>
    </div>
  );
}

/* ------------------------------ Managed projects ------------------------------ */
export function ManagedProjects() {
  useSeo({ title: 'Managed Projects – HN Runs Your Project End-to-End', description: 'An HN project manager coordinates designers, developers and marketers for you, with a single PKR quote and a quality guarantee.', path: '/managed-projects' });
  return (
    <div>
      <section className="bg-navy text-white dark:bg-navy-950">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-200">Managed project</span>
            <h1 className="mt-5 font-heading text-4xl font-bold sm:text-5xl">One project manager. One price. Guaranteed quality.</h1>
            <p className="mt-5 text-lg text-slate-300">Bigger projects need more than one freelancer. An HN project manager plans the work, picks the right people from our agency team and the marketplace, checks every delivery, and keeps you updated on WhatsApp.</p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {[[ClipboardList, 'Written scope and timeline before you pay'], [Users, 'Designers, developers & marketers coordinated for you'], [MessagesSquare, 'Weekly updates in Urdu or English'], [ShieldCheck, 'Quality checked by HN — or your money back']].map(([I, t]) => {
                const Icon = I as typeof Users;
                return <li key={t as string} className="flex items-start gap-3 rounded-2xl bg-white/5 p-4 text-sm"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />{t as string}</li>;
              })}
            </ul>
          </div>
          <Card className="self-start p-6 text-navy dark:text-slate-100 sm:p-8"><h2 className="mb-4 font-heading text-xl font-semibold">Tell us about your project</h2><LeadForm kind="managed_project" /></Card>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionTitle title="How a managed project works" />
        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {['Free consultation call to understand your goals', 'Written proposal with scope, milestones and a fixed PKR price', 'Your PM runs the work and shares progress every week', 'Final review and handover — pay only for approved milestones'].map((t, i) => (
            <Card key={t} className="p-6"><span className="font-heading text-3xl font-bold text-brand">0{i + 1}</span><p className="mt-3 text-sm">{t}</p></Card>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted">Looking for a ready-made bundle? See our <Link to="/agency#pricing" className="font-medium text-brand">agency packages</Link> from PKR 3,000.</p>
      </section>
    </div>
  );
}

/* ------------------------------- Consultation ------------------------------- */
export function Consultation() {
  useSeo({ title: 'Book a Free Consultation', description: 'Book a free 20-minute call with HN Creative Agency to plan your logo, website, social media or ads — in Urdu or English.', path: '/book-consultation' });
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand dark:bg-brand/15"><CalendarDays className="h-4 w-4" />Free · 20 minutes</span>
        <h1 className="mt-4 font-heading text-4xl font-bold text-navy dark:text-white">Book a free consultation</h1>
        <p className="mt-4 text-lg text-muted">Not sure what you need or what it should cost? Talk to our team on a call or WhatsApp — in Urdu or English. No obligation.</p>
        <ul className="mt-6 space-y-3 text-sm">
          {['We understand your business and goals', 'You get a clear recommendation and PKR budget', 'Choose: hire a freelancer, an agency package, or a managed project'].map((t) => (
            <li key={t} className="flex gap-2"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />{t}</li>
          ))}
        </ul>
      </div>
      <Card className="p-6 sm:p-8"><LeadForm kind="consultation" /></Card>
    </div>
  );
}
