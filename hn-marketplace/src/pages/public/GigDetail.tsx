import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Clock, RefreshCw, Check, Heart, MessageSquare, ChevronDown, Pencil, Eye, Ticket } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAsync, useFavorites, q } from '@/lib/hooks';
import type { Gig, GigPackage, PortfolioItem, Review } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Avatar, Badge, Button, Card, EmptyState, ErrorBox, Input, Modal, PageLoader, SafeImg, Stars, Textarea, VerifiedBadge } from '@/components/ui';
import { GuaranteeNote, SellerBadges } from '@/components/marketing';
import { useSeo } from '@/lib/seo';
import { SITE } from '@/lib/site';
import { track } from '@/lib/analytics';
import { AvailabilityBadge, ReportButton } from '@/components/cards';
import { cn, date, money, timeAgo } from '@/lib/utils';
import { GIG_SELECT } from './Home';

export function useStartChat() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const loc = useLocation();
  const [busy, setBusy] = useState(false);
  const start = async (otherId: string, gigId?: string) => {
    if (!user) return nav(`/login?next=${encodeURIComponent(loc.pathname)}`);
    setBusy(true);
    try { const id = await rpc<string>('start_conversation', { p_other: otherId, p_gig_id: gigId ?? null }); nav(`/app/messages/${id}`); }
    catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return { start, busy };
}

export function ReviewList({ reviews, canRespond, onChanged }: { reviews: Review[]; canRespond?: boolean; onChanged?: () => void }) {
  const toast = useToast();
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [text, setText] = useState('');
  if (!reviews.length) return <p className="text-sm text-muted">No reviews yet.</p>;
  const submit = async (id: string) => {
    try { await rpc('respond_review', { p_review: id, p_response: text }); toast.success('Response posted'); setReplyFor(null); setText(''); onChanged?.(); }
    catch (e) { toast.error(e); }
  };
  return (
    <div className="divide-y divide-slate-100 dark:divide-navy-700">
      {reviews.map((r) => (
        <div key={r.id} className="py-4">
          <div className="flex items-center gap-3">
            <Avatar url={r.client?.avatar_url} name={r.client?.full_name} size={34} />
            <div className="flex-1">
              <p className="text-sm font-medium">{r.client?.full_name || 'Client'}</p>
              <p className="text-xs text-muted">{'★'.repeat(r.rating)}<span className="text-slate-300 dark:text-navy-700">{'★'.repeat(5 - r.rating)}</span> · {timeAgo(r.created_at)}</p>
            </div>
            <ReportButton type="review" id={r.id} label="" />
          </div>
          {r.comment && <p className="mt-2 text-sm leading-relaxed text-navy/80 dark:text-slate-300">{r.comment}</p>}
          {r.response && (
            <div className="ml-6 mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-navy-900">
              <p className="text-xs font-medium text-muted">Freelancer response</p>
              <p className="mt-1">{r.response}</p>
            </div>
          )}
          {canRespond && !r.response && (replyFor === r.id ? (
            <div className="ml-6 mt-3 space-y-2">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} placeholder="Write a public response" />
              <div className="flex gap-2"><Button size="sm" onClick={() => submit(r.id)} disabled={text.trim().length < 2}>Post</Button><Button size="sm" variant="ghost" onClick={() => setReplyFor(null)}>Cancel</Button></div>
            </div>
          ) : <button className="ml-6 mt-2 text-xs font-medium text-brand" onClick={() => setReplyFor(r.id)}>Respond</button>)}
        </div>
      ))}
    </div>
  );
}

export default function GigDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const fav = useFavorites();
  const chat = useStartChat();
  const [tier, setTier] = useState<GigPackage['tier']>('basic');
  const [img, setImg] = useState(0);
  const [orderOpen, setOrderOpen] = useState(false);
  const [reqs, setReqs] = useState('');
  const [placing, setPlacing] = useState(false);
  const [faq, setFaq] = useState<number | null>(null);
  const [coupon, setCoupon] = useState('');
  const [price, setPrice] = useState<{ price: number; service_fee: number; discount: number; total: number; coupon_applied: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const gig = await q(supabase.from('gigs').select(`${GIG_SELECT}, gig_packages(*)`).eq('id', id!).maybeSingle()) as Gig | null;
    if (!gig) return null;
    const [reviews, portfolio, more] = await Promise.all([
      q(supabase.from('reviews').select('*, client:profiles!reviews_client_id_fkey(full_name,avatar_url)').eq('gig_id', gig.id).eq('is_hidden', false).order('created_at', { ascending: false }).limit(20)),
      gig.portfolio_ids.length ? q(supabase.from('portfolio_items').select('*').in('id', gig.portfolio_ids)) : Promise.resolve([]),
      q(supabase.from('gigs').select('id', { count: 'exact', head: true }).eq('freelancer_id', gig.freelancer_id).eq('status', 'published')),
    ]);
    return { gig, reviews: reviews as Review[], portfolio: portfolio as PortfolioItem[], more };
  }, [id]);

  const gigData = data?.gig;
  useEffect(() => { if (gigData?.id && gigData.status === 'published') rpc('track_gig_event', { p_gig: gigData.id, p_kind: 'view' }).catch(() => null); }, [gigData?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const allPkgs = (gigData?.gig_packages ?? []).slice().sort((a, b) => ['basic', 'standard', 'premium'].indexOf(a.tier) - ['basic', 'standard', 'premium'].indexOf(b.tier));
  const curPkg = allPkgs.find((p) => p.tier === tier) ?? allPkgs[0];
  const fetchPrice = async (code: string) => {
    if (!curPkg) return;
    setChecking(true);
    try { setPrice(await rpc('preview_order_pricing', { p_package: curPkg.id, p_coupon: code.trim() || null })); if (code.trim()) toast.success('Coupon applied'); }
    catch (e) { toast.error(e); if (code.trim()) { setCoupon(''); fetchPrice(''); } } finally { setChecking(false); }
  };
  useEffect(() => { if (orderOpen) fetchPrice(coupon); else setPrice(null); }, [orderOpen, curPkg?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useSeo(gigData ? {
    title: `${gigData.title.replace(/^I will /i, '').replace(/^./, (c) => c.toUpperCase())} – from ${money(gigData.starting_price)}`,
    description: `${gigData.description.slice(0, 120).replace(/\s+/g, ' ')}… By ${gigData.freelancer?.full_name ?? 'a verified freelancer'} on HN. Payment protected.`,
    path: `/gigs/${gigData.id}`, image: gigData.cover_url, type: 'product', noindex: gigData.status !== 'published',
    jsonLd: { '@context': 'https://schema.org', '@type': 'Product', name: gigData.title, description: gigData.description.slice(0, 300), image: gigData.cover_url && /^https?:/.test(gigData.cover_url) ? gigData.cover_url : undefined,
      brand: { '@type': 'Brand', name: SITE.name }, offers: { '@type': 'AggregateOffer', priceCurrency: 'PKR', lowPrice: gigData.starting_price, offerCount: allPkgs.length || 1 },
      ...(gigData.rating_count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(gigData.rating_avg).toFixed(1), reviewCount: gigData.rating_count } } : {}) },
  } : { title: loading ? 'Loading…' : 'Gig not found', noindex: true });

  if (loading) return <PageLoader />;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorBox message={error} onRetry={reload} /></div>;
  if (!data) return <div className="mx-auto max-w-3xl p-6"><EmptyState title="Gig not found" text="It may have been removed or is not published yet." /></div>;

  const { gig, reviews, portfolio } = data;
  const packages = allPkgs;
  const pkg = curPkg;
  const images = [gig.cover_url, ...gig.gallery].filter(Boolean) as string[];
  const isOwner = user?.id === gig.freelancer_id;

  const placeOrder = async () => {
    if (!pkg) return;
    if (reqs.trim().length < 10) return toast.error('Describe your requirements (at least 10 characters)');
    setPlacing(true);
    try {
      const orderId = await rpc<string>('place_gig_order', { p_package: pkg.id, p_requirements: reqs.trim(), p_files: [], p_coupon: price?.coupon_applied ? coupon.trim() : null });
      track('begin_checkout', { value: price?.total ?? pkg.price, item_id: gig.id });
      nav(`/app/checkout/${orderId}`);
    } catch (e) { toast.error(e); } finally { setPlacing(false); }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {gig.status !== 'published' && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <Eye className="h-4 w-4" />Preview — this gig is <b>{gig.status.replace('_', ' ')}</b> and not visible to the public.
          {gig.rejection_reason && <span>Reason: {gig.rejection_reason}</span>}
        </div>
      )}
      <nav className="mb-4 text-sm text-muted">
        <Link to="/explore" className="hover:text-brand">Explore</Link>
        {gig.category && <> / <Link to={`/explore?category=${gig.category.slug}`} className="hover:text-brand">{gig.category.name}</Link></>}
      </nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold leading-snug text-navy dark:text-white sm:text-3xl">{gig.title}</h1>
          {gig.freelancer && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link to={`/freelancers/${gig.freelancer.id}`} className="flex items-center gap-2">
                <Avatar url={gig.freelancer.avatar_url} name={gig.freelancer.full_name} size={36} />
                <span className="font-medium">{gig.freelancer.full_name}</span>{gig.freelancer.is_verified && <VerifiedBadge />}
              </Link>
              <SellerBadges p={gig.freelancer} />
              <Stars value={gig.rating_avg} count={gig.rating_count} />
              {gig.orders_completed > 0 && <span className="text-sm text-muted">{gig.orders_completed} completed order{gig.orders_completed === 1 ? '' : 's'}</span>}
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl bg-slate-100 dark:bg-navy-800">
            {images.length ? (
              /\.(mp4|webm)$/i.test(images[img]) ? <video src={images[img]} controls className="aspect-video w-full" /> :
                <SafeImg src={images[img]} alt={gig.title} label={gig.category?.name} className="aspect-video w-full object-cover" />
            ) : <div className="flex aspect-video items-center justify-center text-muted">No images</div>}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button key={src} onClick={() => setImg(i)} className={cn('h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2', i === img ? 'border-brand' : 'border-transparent')}>
                  {/\.(mp4|webm)$/i.test(src) ? <video src={src} className="h-full w-full object-cover" /> : <img src={src} alt="" className="h-full w-full object-cover" />}
                </button>
              ))}
            </div>
          )}

          <section className="mt-10">
            <h2 className="font-heading text-xl font-semibold">About this gig</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-navy/80 dark:text-slate-300">{gig.description}</p>
            {gig.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{gig.tags.map((t) => <Link key={t} to={`/explore?q=${encodeURIComponent(t)}`}><Badge>{t}</Badge></Link>)}</div>}
          </section>

          {portfolio.length > 0 && (
            <section className="mt-10">
              <h2 className="font-heading text-xl font-semibold">Portfolio samples</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {portfolio.map((p) => (
                  <Card key={p.id} className="overflow-hidden">
                    {p.media[0] && (p.media[0].type === 'video' ? <video src={p.media[0].url} controls className="aspect-video w-full" /> : <img src={p.media[0].url} alt={p.title} className="aspect-video w-full object-cover" />)}
                    <div className="p-4"><p className="font-medium">{p.title}</p>{p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>}</div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {gig.extras.length > 0 && (
            <section className="mt-10">
              <h2 className="font-heading text-xl font-semibold">Optional extras</h2>
              <p className="mt-1 text-sm text-muted">Ask the freelancer to include these in a custom offer.</p>
              <div className="mt-3 space-y-2">
                {gig.extras.map((x) => (
                  <div key={x.name} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-navy-700">
                    <span>{x.name}{x.days ? <span className="text-muted"> · +{x.days} day{x.days > 1 ? 's' : ''}</span> : null}</span><span className="font-semibold">+{money(x.price)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {gig.faqs.length > 0 && (
            <section className="mt-10">
              <h2 className="font-heading text-xl font-semibold">FAQ</h2>
              <div className="mt-3 space-y-2">
                {gig.faqs.map((f, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 dark:border-navy-700">
                    <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-medium" aria-expanded={faq === i}>
                      {f.q}<ChevronDown className={cn('h-4 w-4 shrink-0 transition', faq === i && 'rotate-180')} />
                    </button>
                    {faq === i && <p className="px-4 pb-4 text-sm text-muted">{f.a}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <h2 className="font-heading text-xl font-semibold">Reviews <span className="text-base font-normal text-muted">({gig.rating_count})</span></h2>
            <div className="mt-2"><ReviewList reviews={reviews} /></div>
          </section>
          <div className="mt-8"><ReportButton type="gig" id={gig.id} label="Report this gig" /></div>
        </div>

        {/* Packages */}
        <aside>
          <Card className="sticky top-24 overflow-hidden">
            {packages.length > 1 && (
              <div className="grid border-b border-slate-200 dark:border-navy-700" style={{ gridTemplateColumns: `repeat(${packages.length}, 1fr)` }}>
                {packages.map((p) => (
                  <button key={p.id} onClick={() => setTier(p.tier)} className={cn('py-3 text-sm font-medium capitalize transition', pkg?.id === p.id ? 'border-b-2 border-brand text-brand' : 'text-muted')}>{p.tier}</button>
                ))}
              </div>
            )}
            {pkg ? (
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-heading font-semibold">{pkg.name}</h3>
                  <span className="font-heading text-2xl font-bold text-navy dark:text-white">{money(pkg.price)}</span>
                </div>
                {pkg.description && <p className="mt-2 text-sm text-muted">{pkg.description}</p>}
                <div className="mt-4 flex gap-4 text-sm font-medium">
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-brand" />{pkg.delivery_days}-day delivery</span>
                  <span className="flex items-center gap-1.5"><RefreshCw className="h-4 w-4 text-brand" />{pkg.revisions} revision{pkg.revisions === 1 ? '' : 's'}</span>
                </div>
                {pkg.features.length > 0 && <ul className="mt-4 space-y-1.5">{pkg.features.map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="h-4 w-4 shrink-0 text-emerald-500" />{f}</li>)}</ul>}
                {isOwner ? (
                  <Link to={`/app/gigs/${gig.id}/edit`} className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-navy font-medium text-white dark:bg-white dark:text-navy"><Pencil className="h-4 w-4" />Edit this gig</Link>
                ) : (
                  <>
                    <Button size="lg" className="mt-5 w-full" disabled={gig.status !== 'published' || profile?.role === 'admin'}
                      onClick={() => (user ? setOrderOpen(true) : nav(`/login?next=/gigs/${gig.id}`))}>Continue ({money(pkg.price)})</Button>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={() => { rpc('track_gig_event', { p_gig: gig.id, p_kind: 'click' }).catch(() => null); chat.start(gig.freelancer_id, gig.id); }} loading={chat.busy}><MessageSquare className="h-4 w-4" />Contact</Button>
                      <Button variant="outline" onClick={() => fav.toggle(gig.id)}><Heart className={cn('h-4 w-4', fav.ids.has(gig.id) && 'fill-red-500 text-red-500')} />{fav.ids.has(gig.id) ? 'Saved' : 'Save'}</Button>
                    </div>
                    <GuaranteeNote className="mt-4 !text-xs" />
                  </>
                )}
              </div>
            ) : <p className="p-5 text-sm text-muted">No packages yet.</p>}
            {gig.freelancer && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm dark:border-navy-700">
                <span className="text-muted">Freelancer status</span><AvailabilityBadge a={gig.freelancer.availability} />
              </div>
            )}
          </Card>
        </aside>
      </div>

      <Modal open={orderOpen} onClose={() => setOrderOpen(false)} title="Your requirements">
        {pkg && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-navy-900">
              <p className="font-medium">{pkg.name} · {money(pkg.price)}</p>
              <p className="text-muted">{pkg.delivery_days}-day delivery · {pkg.revisions} revision{pkg.revisions === 1 ? '' : 's'}</p>
            </div>
            {gig.requirements && <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand/30 dark:bg-brand/10"><p className="font-medium text-brand-700 dark:text-brand-200">The freelancer needs:</p><p className="mt-1 whitespace-pre-line">{gig.requirements}</p></div>}
            <Textarea label="Describe what you need" rows={5} value={reqs} onChange={(e) => setReqs(e.target.value)} maxLength={5000} required
              hint="You can send files in the order chat after checkout." />
            <div className="flex items-end gap-2">
              <div className="flex-1"><Input id="gig-coupon" label="Coupon code" placeholder="WELCOME10" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} maxLength={30} /></div>
              <Button variant="outline" loading={checking} disabled={!coupon.trim()} onClick={() => fetchPrice(coupon)}><Ticket className="h-4 w-4" />Apply</Button>
            </div>
            {price && (
              <dl className="space-y-1.5 rounded-xl border border-slate-200 p-3 text-sm dark:border-navy-700">
                <div className="flex justify-between"><dt className="text-muted">Package</dt><dd>{money(price.price)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Service fee</dt><dd>{price.service_fee ? money(price.service_fee) : <span className="font-medium text-emerald-600">Free</span>}</dd></div>
                {price.discount > 0 && <div className="flex justify-between text-emerald-600"><dt>Coupon {coupon}</dt><dd>−{money(price.discount)}</dd></div>}
                <div className="flex justify-between border-t border-slate-100 pt-1.5 font-semibold dark:border-navy-700"><dt>Total</dt><dd>{money(price.total)}</dd></div>
              </dl>
            )}
            <Button size="lg" className="w-full" loading={placing} onClick={placeOrder}>Continue to checkout</Button>
            <p className="text-center text-xs text-muted">Nothing is charged yet. Your payment is held safely until you approve the delivery.</p>
          </div>
        )}
      </Modal>
      <p className="mt-6 text-xs text-muted">Published {date(gig.published_at)}</p>
    </div>
  );
}
