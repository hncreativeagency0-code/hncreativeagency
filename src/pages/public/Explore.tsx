import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, PackageSearch } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAsync, useCategories, useFavorites } from '@/lib/hooks';
import type { Gig, Profile } from '@/lib/types';
import { GigCard, FreelancerCard } from '@/components/cards';
import { Button, EmptyState, ErrorBox, Input, Pagination, Select, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useSeo } from '@/lib/seo';

const PAGE = 24;
const INNER_SELECT = '*, freelancer:profiles!gigs_freelancer_id_fkey!inner(id,full_name,avatar_url,title,is_verified,availability,rating_avg,rating_count,status,seller_level,founding_until), category:categories!gigs_category_id_fkey(name,slug)';

function FilterPanel({ params, set, onClose }: { params: URLSearchParams; set: (k: string, v: string | null) => void; onClose?: () => void }) {
  const { parents, childrenOf, all } = useCategories();
  const catSlug = params.get('category');
  const cat = all.find((c) => c.slug === catSlug);
  const parent = cat?.parent_id ? all.find((c) => c.id === cat.parent_id) : cat;
  return (
    <div className="space-y-5">
      {onClose && <div className="flex items-center justify-between"><span className="font-heading font-semibold">Filters</span><button onClick={onClose} aria-label="Close filters"><X className="h-5 w-5" /></button></div>}
      <Select label="Category" value={parent?.slug ?? ''} onChange={(e) => set('category', e.target.value || null)}>
        <option value="">All categories</option>
        {parents.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
      </Select>
      {parent && childrenOf(parent.id).length > 0 && (
        <Select label="Subcategory" value={cat?.parent_id ? cat.slug : ''} onChange={(e) => set('category', e.target.value || parent.slug)}>
          <option value="">All {parent.name}</option>
          {childrenOf(parent.id).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </Select>
      )}
      <div>
        <p className="mb-1.5 text-sm font-medium">Budget (PKR)</p>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Min" type="number" min={0} defaultValue={params.get('min') ?? ''} onBlur={(e) => set('min', e.target.value || null)} aria-label="Minimum price" />
          <Input placeholder="Max" type="number" min={0} defaultValue={params.get('max') ?? ''} onBlur={(e) => set('max', e.target.value || null)} aria-label="Maximum price" />
        </div>
      </div>
      <Select label="Delivery time" value={params.get('days') ?? ''} onChange={(e) => set('days', e.target.value || null)}>
        <option value="">Any time</option>
        <option value="1">Up to 24 hours</option><option value="3">Up to 3 days</option><option value="7">Up to 7 days</option><option value="14">Up to 14 days</option>
      </Select>
      <Select label="Rating" value={params.get('rating') ?? ''} onChange={(e) => set('rating', e.target.value || null)}>
        <option value="">Any rating</option><option value="4.5">4.5 & up</option><option value="4">4.0 & up</option><option value="3">3.0 & up</option>
      </Select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-brand" checked={params.get('available') === '1'} onChange={(e) => set('available', e.target.checked ? '1' : null)} />
        Available freelancers only
      </label>
      <Button variant="ghost" size="sm" onClick={() => ['category', 'min', 'max', 'days', 'rating', 'available'].forEach((k) => set(k, null))}>Clear filters</Button>
    </div>
  );
}

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const [mobileFilters, setMobileFilters] = useState(false);
  const { all } = useCategories();
  const fav = useFavorites();
  const page = Number(params.get('page') ?? 0);

  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v === null || v === '') n.delete(k); else n.set(k, v);
    if (k !== 'page') n.delete('page');
    setParams(n, { replace: true });
  };
  useEffect(() => { setTerm(params.get('q') ?? ''); }, [params]);

  const key = params.toString();
  const catReady = !params.get('category') || all.length > 0;
  const { data, loading, error, reload } = useAsync(async () => {
    if (!catReady) return null;
    let query = supabase.from('gigs').select(INNER_SELECT, { count: 'exact' }).eq('status', 'published').eq('freelancer.status', 'active');
    const qv = params.get('q');
    if (qv) query = query.textSearch('search', qv, { type: 'websearch', config: 'simple' });
    const cat = all.find((c) => c.slug === params.get('category'));
    if (cat) query = cat.parent_id ? query.eq('subcategory_id', cat.id) : query.eq('category_id', cat.id);
    if (params.get('min')) query = query.gte('starting_price', Number(params.get('min')));
    if (params.get('max')) query = query.lte('starting_price', Number(params.get('max')));
    if (params.get('days')) query = query.lte('min_delivery_days', Number(params.get('days')));
    if (params.get('rating')) query = query.gte('rating_avg', Number(params.get('rating')));
    if (params.get('available') === '1') query = query.eq('freelancer.availability', 'available');
    const sort = params.get('sort') ?? 'recommended';
    query = sort === 'recommended' ? query.order('seller_rank', { ascending: false }).order('rating_avg', { ascending: false }).order('published_at', { ascending: false })
      : sort === 'newest' ? query.order('published_at', { ascending: false })
      : sort === 'price_asc' ? query.order('starting_price', { ascending: true })
      : sort === 'price_desc' ? query.order('starting_price', { ascending: false })
      : sort === 'rating' ? query.order('rating_avg', { ascending: false }).order('rating_count', { ascending: false })
      : query.order('published_at', { ascending: false });
    const { data, count, error } = await query.range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    return { gigs: (data ?? []) as Gig[], count: count ?? 0 };
  }, [key, catReady]);

  const activeCat = useMemo(() => all.find((c) => c.slug === params.get('category')), [all, params]);
  useSeo({
    title: activeCat ? `${activeCat.name} Services in Pakistan` : params.get('q') ? `“${params.get('q')}” services` : 'Explore Freelance Services in Pakistan',
    description: activeCat ? `Hire verified Pakistani freelancers for ${activeCat.name.toLowerCase()}. Clear PKR packages, payment protection and a money-back guarantee.` : undefined,
    path: activeCat ? `/explore?category=${activeCat.slug}` : '/explore', noindex: !!params.get('q') || Number(params.get('page') ?? 0) > 0,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-navy dark:text-white">{activeCat ? activeCat.name : params.get('q') ? `Results for “${params.get('q')}”` : 'Explore services'}</h1>
          <p className="mt-1 text-sm text-muted">{data ? `${data.count} service${data.count === 1 ? '' : 's'} available` : 'Loading services…'}</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); set('q', term.trim() || null); }} className="flex w-full gap-2 md:w-96">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search services" aria-label="Search services"
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand dark:border-navy-700 dark:bg-navy-900" />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-24"><FilterPanel params={params} set={set} /></div></aside>
        <div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMobileFilters(true)}><SlidersHorizontal className="h-4 w-4" />Filters</Button>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-muted">Sort</span>
              <select value={params.get('sort') ?? 'recommended'} onChange={(e) => set('sort', e.target.value)} aria-label="Sort"
                className="h-9 rounded-xl border border-slate-300 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900">
                <option value="recommended">Recommended</option><option value="newest">Newest</option><option value="rating">Best rated</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
              </select>
            </div>
          </div>
          {error && <ErrorBox message={error} onRetry={reload} />}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
            {!loading && data?.gigs.map((g) => <GigCard key={g.id} gig={g} favorite={fav.ids.has(g.id)} onToggleFavorite={() => fav.toggle(g.id)} />)}
          </div>
          {!loading && data && data.gigs.length === 0 && (
            <EmptyState icon={PackageSearch} title="No services match your filters" text="Try a broader search, remove a filter, or browse freelancers and send a custom request." />
          )}
          {data && <Pagination page={page} hasMore={(page + 1) * PAGE < data.count} onPage={(p) => set('page', String(p))} />}
        </div>
      </div>

      {mobileFilters && (
        <div className="fixed inset-0 z-[80] bg-navy/50 lg:hidden" onClick={() => setMobileFilters(false)}>
          <div className={cn('absolute bottom-0 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 dark:bg-navy-900')} onClick={(e) => e.stopPropagation()}>
            <FilterPanel params={params} set={set} onClose={() => setMobileFilters(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export function Freelancers() {
  const [params, setParams] = useSearchParams();
  useSeo({ title: 'Hire Pakistani Freelancers', description: 'Browse verified Pakistani designers, video editors, developers and marketers. Compare ratings, portfolios and PKR prices.', path: '/freelancers' });
  const [term, setTerm] = useState(params.get('q') ?? '');
  const page = Number(params.get('page') ?? 0);
  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (!v) n.delete(k); else n.set(k, v);
    if (k !== 'page') n.delete('page');
    setParams(n, { replace: true });
  };
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('profiles').select('*', { count: 'exact' }).eq('role', 'freelancer').eq('status', 'active').eq('profile_completed', true);
    const qv = params.get('q')?.trim();
    if (qv) {
      const safe = qv.replace(/[%,()]/g, ' ');
      query = query.or(`full_name.ilike.%${safe}%,title.ilike.%${safe}%,skills.cs.{${safe.replace(/[{}"]/g, '')}}`);
    }
    if (params.get('available') === '1') query = query.eq('availability', 'available');
    if (params.get('verified') === '1') query = query.eq('is_verified', true);
    const sort = params.get('sort') ?? 'rating';
    query = sort === 'newest' ? query.order('created_at', { ascending: false }) : sort === 'orders' ? query.order('completed_orders', { ascending: false })
      : query.order('rating_avg', { ascending: false }).order('rating_count', { ascending: false });
    const { data, count, error } = await query.range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    return { list: (data ?? []) as Profile[], count: count ?? 0 };
  }, [params.toString()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-semibold text-navy dark:text-white">Browse freelancers</h1>
      <p className="mt-1 text-sm text-muted">{data ? `${data.count} freelancer${data.count === 1 ? '' : 's'}` : 'Loading…'}</p>
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <form onSubmit={(e) => { e.preventDefault(); set('q', term.trim() || null); }} className="flex flex-1 gap-2">
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name, title or exact skill" aria-label="Search freelancers"
            className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand dark:border-navy-700 dark:bg-navy-900" />
          <Button type="submit">Search</Button>
        </form>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand" checked={params.get('available') === '1'} onChange={(e) => set('available', e.target.checked ? '1' : null)} />Available</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand" checked={params.get('verified') === '1'} onChange={(e) => set('verified', e.target.checked ? '1' : null)} />Verified</label>
          <select value={params.get('sort') ?? 'rating'} onChange={(e) => set('sort', e.target.value)} aria-label="Sort" className="h-9 rounded-xl border border-slate-300 bg-white px-2 dark:border-navy-700 dark:bg-navy-900">
            <option value="rating">Best rated</option><option value="orders">Most orders</option><option value="newest">Newest</option>
          </select>
        </div>
      </div>
      {error && <div className="mt-6"><ErrorBox message={error} onRetry={reload} /></div>}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        {!loading && data?.list.map((f) => <FreelancerCard key={f.id} f={f} />)}
      </div>
      {!loading && data?.list.length === 0 && <EmptyState title="No freelancers found" text="Try a different search or remove filters." />}
      {data && <Pagination page={page} hasMore={(page + 1) * PAGE < data.count} onPage={(p) => set('page', String(p))} />}
    </div>
  );
}
