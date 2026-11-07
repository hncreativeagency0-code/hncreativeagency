import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Mail, Phone, MapPin, MessageCircle, MapPinned, Target, Eye, ShieldCheck, UserCheck, CalendarDays, Star } from 'lucide-react';
import { Button, Card, LegacyImg, ButtonLink, Modal } from '@/components/ui';
import { BrandIcon } from '@/components/Layout';
import { LeadForm } from '@/components/marketing';
import { supabase } from '@/lib/supabase';
import { useAsync } from '@/lib/hooks';
import { useSiteContact } from '@/lib/site';
import { useSeo } from '@/lib/seo';
import { AGENCY_PLANS } from '@/content/services';
import { STUDIO_WORK } from '@/content/caseStudies';
import type { Review } from '@/lib/types';
import { cn, money } from '@/lib/utils';
import { ContactForm } from './Contact';

/* Content carried over from the original hncreativeagency.pages.dev site.
   Unproven claims (awards, "worldwide", stats, testimonials) were removed — add them back
   only with proof (links, screenshots, client permission). */

const SERVICES = [
  { t: 'Graphic Design', d: "Visual assets that communicate your brand's identity across every touchpoint.", items: ['Social Media Design', 'Marketing Materials', 'Print Design', 'Presentation Design'], cat: 'graphic-design' },
  { t: 'Branding', d: 'A cohesive brand identity that sets you apart and builds lasting recognition.', items: ['Logo Design', 'Brand Identity', 'Brand Guidelines', 'Brand Positioning'], cat: 'logo-brand-identity' },
  { t: 'Video Editing', d: 'Scroll-stopping video content crafted for maximum engagement across all platforms.', items: ['Reels & Shorts', 'Commercial Videos', 'Promotional Content', 'Motion Graphics'], cat: 'video-editing' },
  { t: 'Website Design & Dev', d: 'High-performance websites that look stunning and convert visitors into clients.', items: ['Business Websites', 'Portfolio Websites', 'Landing Pages', 'Responsive Design'], cat: 'website-design-development' },
  { t: 'Social Media Management', d: 'End-to-end social presence management that builds community and drives growth.', items: ['Content Planning', 'Scheduling', 'Community Management', 'Performance Monitoring'], cat: 'social-media-management' },
  { t: 'Digital Marketing', d: 'Data-driven campaigns that generate leads, conversions, and measurable ROI.', items: ['Meta & Google Ads', 'Lead Generation', 'Conversion Optimization', 'Analytics & Reporting'], cat: 'digital-marketing' },
];

const MARQUEE = ['Graphic Design', 'Branding', 'Web Development', 'UI/UX Design', 'Digital Marketing', 'SEO', 'Social Media Marketing', 'Content Creation', 'Video Editing', 'Motion Graphics', 'AI Automation', 'E-commerce Solutions', 'App Development', 'Cloud Solutions'];

/* Tools we use — plain names only (no brand logos: we show logos only with a real partnership or permission). */
const TOOLS = ['Figma', 'Adobe Illustrator', 'Photoshop', 'Premiere Pro', 'After Effects', 'Canva', 'Shopify', 'WordPress', 'WooCommerce',
  'Meta Ads Manager', 'Google Ads', 'Google Analytics', 'Tag Manager', 'TikTok Ads', 'Cloudflare', 'GitHub'];

const PROJECTS = STUDIO_WORK;

const WHY = [
  { t: 'Creative Excellence', d: 'Every project is crafted with a distinct point of view. We bring originality, intention, and craft to each deliverable — not templates.' },
  { t: 'Fast Delivery', d: 'We respect your time. Our streamlined process ensures projects are delivered on schedule without compromising on quality.' },
  { t: 'Results-Driven', d: 'Everything we build is tied to business outcomes — more leads, stronger brand recall, higher conversions, and measurable growth.' },
  { t: 'Clear Communication', d: "Transparent timelines, honest feedback, and regular updates. You'll always know exactly where your project stands." },
];

const PROCESS = [
  { t: 'Discovery', d: "We dive deep into your goals, audience, and competitive landscape to fully understand your brand's context and opportunities." },
  { t: 'Strategy', d: 'We map out a clear roadmap — messaging frameworks, visual direction, and campaign architecture tailored to your goals.' },
  { t: 'Design & Build', d: 'Our team executes with precision — designing, developing, and refining until every element reflects your brand perfectly.' },
  { t: 'Launch & Grow', d: 'We launch your project and continue supporting growth through ongoing optimization, analytics, and strategic iterations.' },
];


const CEO_SOCIALS = [
  ['x', 'https://x.com/haseebulhasanof'], ['linkedin', 'https://www.linkedin.com/in/haseeb-ul-hasan-43104333a/'],
  ['instagram', 'https://www.instagram.com/haseebulhasanofficial/'], ['youtube', 'https://www.youtube.com/@Haseeb-ul-Hasan-official'],
];

function SectionTitle({ eyebrow, title, sub, light }: { eyebrow: string; title: string; sub?: string; light?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-sm font-semibold uppercase tracking-wider text-brand">{eyebrow}</span>
      <h2 className={cn('mt-2 font-heading text-3xl font-semibold sm:text-4xl', light ? 'text-white' : 'text-navy dark:text-white')}>{title}</h2>
      {sub && <p className={cn('mt-3', light ? 'text-slate-300' : 'text-muted')}>{sub}</p>}
    </div>
  );
}

export default function Agency() {
  const [params] = useSearchParams();
  const c = useSiteContact();
  const [filter, setFilter] = useState('All');
  const [plan, setPlan] = useState<string | null>(null);
  const [consult, setConsult] = useState(false);
  const shown = PROJECTS.filter((p) => filter === 'All' || p.c === filter);
  const reviews = useAsync(async () => {
    const { data } = await supabase.from('reviews').select('*, client:profiles!reviews_client_id_fkey(full_name,avatar_url)').eq('is_hidden', false).gte('rating', 4).not('comment', 'is', null).order('created_at', { ascending: false }).limit(3);
    return (data ?? []) as Review[];
  }, []);
  useEffect(() => { const p = params.get('plan'); if (p && AGENCY_PLANS.some((x) => x.id === p)) setPlan(p); }, [params]);
  useSeo({ title: 'Creative Agency in Lahore – Branding, Websites & Marketing in PKR', description: 'HN Creative Agency’s in-house team handles branding, websites, social media and ads for Pakistani businesses. Packages from PKR 3,000 with a dedicated project manager.', path: '/agency' });
  const selected = AGENCY_PLANS.find((x) => x.id === plan);
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white dark:bg-navy-950">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-200">Full-service digital agency · Lahore</span>
            <h1 className="mt-5 font-heading text-5xl font-bold leading-tight sm:text-6xl">Design <span className="text-brand-300">Market</span> Grow</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              HN Creative Agency helps businesses grow through creative design, powerful branding, strategic marketing, social media management, and high-performance websites.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#pricing" className="inline-flex h-12 items-center rounded-xl bg-brand px-6 font-medium hover:bg-brand-600">See packages</a>
              <button onClick={() => setConsult(true)} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 px-6 font-medium hover:border-brand-300"><CalendarDays className="h-4 w-4" />Free consultation</button>
            </div>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-6">
              {[['PKR', 'Clear, fixed prices'], ['1 PM', 'One project manager'], ['اردو', 'Urdu & English']].map(([v, l]) => (
                <div key={l}><p className="font-heading text-2xl font-bold">{v}</p><p className="text-sm text-slate-400">{l}</p></div>
              ))}
            </div>
          </div>
          <div className="relative">
            <LegacyImg src="/logo.png" alt="HN Creative Agency" className="mx-auto w-full max-w-md drop-shadow-2xl" />
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><MapPinned className="h-4 w-4 text-brand-300" />Lahore-based team</span>
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><ShieldCheck className="h-4 w-4 text-brand-300" />Serving Pakistan</span>
            </div>
          </div>
        </div>
        <div className="overflow-hidden border-y border-white/10 bg-brand py-3">
          <div className="flex w-max animate-marquee gap-8 whitespace-nowrap text-sm font-medium">
            {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m} ✦</span>)}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <span className="text-sm font-semibold uppercase tracking-wider text-brand">About Us</span>
          <h2 className="mt-2 font-heading text-3xl font-semibold text-navy dark:text-white sm:text-4xl">We Build Brands That Leave a Mark</h2>
          <p className="mt-4 leading-relaxed text-muted">HN Creative Agency is a full-service digital agency helping brands establish a strong online presence through strategic design, development, branding, and marketing solutions.</p>
          <p className="mt-3 leading-relaxed text-muted">We combine creativity with strategy to deliver impactful digital experiences that drive business growth. Our team of experts brings together design thinking, technical mastery, and marketing intelligence.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-6"><Target className="h-6 w-6 text-brand" /><h3 className="mt-3 font-heading font-semibold">Our Mission</h3><p className="mt-1 text-sm text-muted">Empower brands with impactful design and smart strategy</p></Card>
          <Card className="p-6"><Eye className="h-6 w-6 text-brand" /><h3 className="mt-3 font-heading font-semibold">Our Vision</h3><p className="mt-1 text-sm text-muted">Become Pakistan’s most trusted creative agency</p></Card>
          <Card className="p-6"><UserCheck className="h-6 w-6 text-brand" /><h3 className="mt-3 font-heading font-semibold">One project manager</h3><p className="mt-1 text-sm text-muted">A single person coordinates designers, developers and marketers for you</p></Card>
          <Card className="p-6"><ShieldCheck className="h-6 w-6 text-brand" /><h3 className="mt-3 font-heading font-semibold">Quality guarantee</h3><p className="mt-1 text-sm text-muted">Agreed scope delivered — or your money back</p></Card>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-surface py-20 dark:bg-navy-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionTitle eyebrow="Our Services" title="Everything Your Brand Needs" sub="From initial concept to digital launch — we cover every dimension of your brand's growth." />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <Card key={s.t} className="group p-6 transition hover:-translate-y-1 hover:shadow-lift">
                <h3 className="font-heading text-lg font-semibold text-navy dark:text-white">{s.t}</h3>
                <p className="mt-2 text-sm text-muted">{s.d}</p>
                <ul className="mt-4 space-y-1.5">{s.items.map((i) => <li key={i} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-brand" />{i}</li>)}</ul>
                <Link to={`/explore?category=${s.cat}`} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand">Find freelancers<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="py-16">
        <SectionTitle eyebrow="Our Toolkit" title="Tools we work with" sub="Industry-standard software for design, video, web and ads." />
        <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2 px-4">
          {TOOLS.map((name) => (
            <span key={name} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-muted dark:border-navy-700 dark:bg-navy-800">{name}</span>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted">Product names belong to their owners. No partnership or endorsement is implied.</p>
      </section>

      {/* Portfolio */}
      <section id="portfolio" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="Our Work" title="Studio samples" sub="Samples from our studio across branding, web and social media. Detailed case studies are published with client permission." />
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {['All', 'Branding', 'Web Design', 'Social Media', 'Graphic Design'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('rounded-full px-4 py-1.5 text-sm font-medium transition', filter === f ? 'bg-brand text-white' : 'bg-slate-100 text-muted hover:text-navy dark:bg-navy-800 dark:hover:text-white')}>{f}</button>
          ))}
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <div key={p.n} className="group relative overflow-hidden rounded-2xl">
              <LegacyImg src={`/project-${p.n}.jpg`} alt={`${p.t} project preview`} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-navy/90 via-navy/20 to-transparent p-5 text-white">
                <span className="text-xs font-medium text-brand-200">{p.c}</span>
                <h3 className="font-heading text-lg font-semibold">{p.t}</h3>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center"><ButtonLink to="/case-studies" variant="outline">Case studies <ArrowRight className="h-4 w-4" /></ButtonLink></div>
      </section>

      {/* Why us */}
      <section className="bg-navy py-20 text-white dark:bg-navy-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionTitle light eyebrow="Why HN Creative" title="Why Brands Choose Us" sub="We don't just deliver work — we deliver results that move the needle for your business." />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {WHY.map((w, i) => (
              <div key={w.t} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <span className="font-heading text-3xl font-bold text-brand-300">0{i + 1}</span>
                <h3 className="mt-3 font-heading font-semibold">{w.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="How We Work" title="Our Process" sub="A structured yet flexible workflow that keeps your project on track from idea to launch." />
        <div className="mt-12 grid gap-5 md:grid-cols-4">
          {PROCESS.map((p, i) => (
            <div key={p.t} className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand font-heading text-lg font-bold text-white">{i + 1}</div>
              <h3 className="mt-4 font-heading font-semibold text-navy dark:text-white">{p.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews — only from real, completed orders */}
      <section id="testimonials" className="bg-surface py-20 dark:bg-navy-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionTitle eyebrow="Verified reviews" title="What clients say" sub="We only show reviews left on completed, paid orders — never written by us." />
          {reviews.data && reviews.data.length > 0 ? (
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {reviews.data.map((r) => (
                <Card key={r.id} className="flex flex-col p-6">
                  <p className="flex text-amber-400">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-navy/80 dark:text-slate-300">“{r.comment}”</p>
                  <p className="mt-5 text-sm font-semibold">{r.client?.full_name || 'Verified client'}<span className="ml-2 text-xs font-normal text-emerald-600">✓ Verified order</span></p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="mx-auto mt-10 max-w-2xl p-8 text-center">
              <p className="font-heading font-semibold">Reviews appear here after real orders</p>
              <p className="mt-1 text-sm text-muted">Every review on HN comes from a completed, paid order. Be one of our first clients and get 10% off with code WELCOME10.</p>
            </Card>
          )}
        </div>
      </section>

      {/* CEO */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid items-start gap-10 lg:grid-cols-[340px_1fr]">
          <div className="text-center lg:sticky lg:top-24">
            <LegacyImg src="/assets/images/image.png" alt="Haseeb Noor, CEO & Founder of HN Creative Agency" className="mx-auto aspect-square w-full max-w-xs rounded-3xl object-cover shadow-card" />
            <h3 className="mt-4 font-heading text-xl font-semibold">Haseeb Noor</h3>
            <p className="text-sm text-muted">CEO & Founder</p>
            <div className="mt-3 flex justify-center gap-2">
              {CEO_SOCIALS.map(([slug, href]) => (
                <a key={slug} href={href} target="_blank" rel="noopener noreferrer" aria-label={slug} className="rounded-xl bg-slate-100 p-2 hover:bg-brand-100 dark:bg-navy-800"><BrandIcon slug={slug} color="6C63FF" /></a>
              ))}
            </div>
          </div>
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-brand">Message From Our CEO</span>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-navy dark:text-white">Building Digital Growth Through Creativity & Strategy</h2>
            <div className="mt-5 space-y-4 leading-relaxed text-muted">
              <p>Welcome to HN Creative Agency.</p>
              <p>I started this agency on a simple belief — that great design and smart marketing shouldn't be separate conversations. They should work together, from the first line of a brand's story to the strategy that helps it grow.</p>
              <p>That's why we bring creative design, branding, website development, social media management, and digital marketing together under one roof, so every part of a brand's digital presence feels intentional and connected.</p>
              <p>Every project starts with listening. We take the time to understand what makes a business different, then turn that into design and strategy that actually moves the needle — not just impressions, but real engagement and growth.</p>
              <p>We're just as proud of the process as we are of the results. Clear communication, honest timelines, and work we'd put our own name on — that's the standard we hold ourselves to on every project, big or small.</p>
              <p>Thank you for taking the time to learn a little more about who we are and how we work.</p>
              <p className="font-heading font-semibold text-navy dark:text-white">Haseeb Noor<br /><span className="text-sm font-normal text-muted">CEO & Founder, HN Creative Agency</span></p>
            </div>
            <Card className="mt-8 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
              <BrandIcon slug="youtube" color="FF0000" className="h-10 w-10" />
              <div className="flex-1">
                <p className="font-heading font-semibold">Insights From Our CEO</p>
                <p className="text-sm text-muted">Explore insights, ideas, creative thinking, and practical strategies for building a stronger digital presence.</p>
              </div>
              <a href="https://www.youtube.com/@Haseeb-ul-Hasan-official" target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-medium text-white">Visit channel</a>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-surface py-20 dark:bg-navy-950/40">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <SectionTitle eyebrow="Agency packages" title="Choose your package" sub="Managed by HN’s in-house team. All prices in PKR, one-time unless stated. For single tasks, browse the marketplace." />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {AGENCY_PLANS.map((pl) => (
              <Card key={pl.id} className={cn('flex flex-col p-6', pl.hot && 'border-brand ring-2 ring-brand')}>
                <div className="flex items-center justify-between"><p className="font-heading text-lg font-semibold">{pl.name}</p>{pl.hot && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">Most popular</span>}</div>
                <p className="text-sm text-muted">{pl.tagline}</p>
                <p className="mt-5 font-heading text-3xl font-bold text-navy dark:text-white">{pl.price ? money(pl.price) : 'Custom quote'}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm">{pl.includes.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{i}</li>)}</ul>
                <Button variant={pl.hot ? 'primary' : 'outline'} className="mt-6" onClick={() => setPlan(pl.id)}>{pl.price ? 'Choose plan' : 'Get a quote'} →</Button>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted">Scope is confirmed in writing after a free consultation. Need a bigger, multi-freelancer project? <Link to="/managed-projects" className="font-medium text-brand">Request a managed project</Link>.</p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <span className="text-sm font-semibold uppercase tracking-wider text-brand">Get In Touch</span>
          <h2 className="mt-2 font-heading text-3xl font-semibold text-navy dark:text-white sm:text-4xl">Let's Build Something Great</h2>
          <p className="mt-3 text-muted">Ready to take your brand to the next level? Tell us about your project and we'll get back within 24 hours.</p>
          <div className="mt-8 space-y-4">
            {[
              { i: Mail, l: 'Email', v: c.email, h: `mailto:${c.email}` },
              { i: Phone, l: 'Phone', v: c.phone, h: c.telUrl },
              { i: MessageCircle, l: 'WhatsApp', v: c.phone, h: c.whatsappUrl },
              { i: MapPin, l: 'Location', v: c.address },
            ].map((c) => (
              <div key={c.l} className="flex items-start gap-3">
                <span className="rounded-xl bg-brand-50 p-2.5 dark:bg-brand/15"><c.i className="h-5 w-5 text-brand" /></span>
                <div><p className="text-xs text-muted">{c.l}</p>{c.h ? <a href={c.h} className="font-medium hover:text-brand">{c.v}</a> : <p className="font-medium">{c.v}</p>}</div>
              </div>
            ))}
          </div>
          <ButtonLink to="/explore" variant="outline" className="mt-8">Or hire a freelancer directly <ArrowRight className="h-4 w-4" /></ButtonLink>
        </div>
        <Card className="p-6 sm:p-8"><ContactForm /></Card>
      </section>
      <Modal open={!!selected} onClose={() => setPlan(null)} title={selected ? `${selected.name} package${selected.price ? ` · ${money(selected.price)}` : ''}` : ''}>
        {selected && <LeadForm kind="agency_package" packageName={`${selected.name}${selected.price ? ` (${money(selected.price)})` : ''}`} />}
      </Modal>
      <Modal open={consult} onClose={() => setConsult(false)} title="Book a free consultation"><LeadForm kind="consultation" /></Modal>
    </div>
  );
}
