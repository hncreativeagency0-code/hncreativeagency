import { askConfirm } from '@/context/DialogContext';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Eye, Trash2, Send, EyeOff, Upload, X, ImageIcon, ShoppingBag, Wand2, CheckCircle2, Circle, BarChart3 } from 'lucide-react';
import { supabase, rpc, errorMessage } from '@/lib/supabase';
import { useAsync, useCategories, q } from '@/lib/hooks';
import { uploadPublic } from '@/lib/storage';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Gig, GigPackage, GigStatus, PortfolioItem } from '@/lib/types';
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Select, Textarea } from '@/components/ui';
import { gigChecklist, qualityScore, suggestDescription, suggestTitles } from '@/lib/gigQuality';
import { TagInput } from '@/components/TagInput';
import { cn, money } from '@/lib/utils';
import type { Tone } from '@/lib/utils';

const GIG_STATUS: Record<GigStatus, [string, Tone]> = {
  draft: ['Draft', 'slate'], pending_review: ['In review', 'amber'], published: ['Live', 'green'], unpublished: ['Paused', 'slate'], rejected: ['Needs changes', 'red'],
};

export function MyGigs() {
  const { profile } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => q(supabase.from('gigs').select('*, gig_packages(price)').eq('freelancer_id', profile!.id).order('created_at', { ascending: false })) as Promise<Gig[]>, [profile?.id]);
  const act = async (fn: () => PromiseLike<unknown>, msg: string) => {
    try { const r = await fn() as { error?: unknown }; if (r && r.error) throw r.error; toast.success(msg); reload(); } catch (e) { toast.error(e); }
  };
  return (
    <div>
      <PageHeader title="My gigs" subtitle="Create, publish and manage your services." action={<div className="flex gap-2"><ButtonLink to="/app/analytics" variant="outline"><BarChart3 className="h-4 w-4" />Analytics</ButtonLink><ButtonLink to="/app/gigs/new"><Plus className="h-4 w-4" />New gig</ButtonLink></div>} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading ? <PageLoader /> : !data?.length ? (
        <EmptyState icon={ShoppingBag} title="No gigs yet" text="A gig is a service you offer with fixed packages. Clients can order it instantly." action={<ButtonLink to="/app/gigs/new">Create your first gig</ButtonLink>} />
      ) : (
        <div className="space-y-3">
          {data.map((g) => {
            const [label, tone] = GIG_STATUS[g.status];
            return (
              <Card key={g.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-navy-700">{g.cover_url && <img src={g.cover_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={tone}>{label}</Badge>{g.starting_price && <span className="text-sm text-muted">From {money(g.starting_price)}</span>}</div>
                  <p className="mt-1 truncate font-medium">{g.title}</p>
                  <p className="text-xs text-muted">{g.orders_completed} completed · {g.rating_count} review{g.rating_count === 1 ? '' : 's'}{g.rating_count ? ` · ${Number(g.rating_avg).toFixed(1)}★` : ''}</p>
                  {g.status === 'rejected' && g.rejection_reason && <p className="mt-1 text-xs text-red-500">Reviewer note: {g.rejection_reason}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/gigs/${g.id}`} className="inline-flex h-8 items-center gap-1 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-navy-700"><Eye className="h-4 w-4" />Preview</Link>
                  <Link to={`/app/gigs/${g.id}/edit`} className="inline-flex h-8 items-center gap-1 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-navy-700"><Pencil className="h-4 w-4" />Edit</Link>
                  {['draft', 'unpublished', 'rejected'].includes(g.status) && <Button size="sm" onClick={() => act(() => rpc('publish_gig', { p_gig_id: g.id }), 'Submitted')}><Send className="h-4 w-4" />Publish</Button>}
                  {['published', 'pending_review'].includes(g.status) && <Button size="sm" variant="outline" onClick={() => act(() => supabase.from('gigs').update({ status: 'unpublished' }).eq('id', g.id), 'Gig paused')}><EyeOff className="h-4 w-4" />Unpublish</Button>}
                  <Button size="sm" variant="ghost" onClick={() => askConfirm('Delete this gig permanently?', { danger: true, confirmLabel: 'Delete' }).then((ok) => { if (ok) act(() => supabase.from('gigs').delete().eq('id', g.id), 'Gig deleted'); })} aria-label="Delete gig"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

type PkgDraft = Omit<GigPackage, 'id' | 'gig_id'> & { id?: string; enabled: boolean };
const emptyPkg = (tier: GigPackage['tier'], enabled: boolean): PkgDraft => ({ tier, name: tier[0].toUpperCase() + tier.slice(1), description: '', price: 0, delivery_days: 3, revisions: 1, features: [], enabled });

export function GigEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { user, profile } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { parents, childrenOf } = useCategories();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [g, setG] = useState({
    title: '', category_id: '', subcategory_id: '', description: '', tags: [] as string[], cover_url: '' as string | null, gallery: [] as string[],
    requirements: '', faqs: [] as { q: string; a: string }[], extras: [] as { name: string; price: number; days?: number }[], portfolio_ids: [] as string[], status: 'draft' as GigStatus,
  });
  const [pkgs, setPkgs] = useState<PkgDraft[]>([emptyPkg('basic', true), emptyPkg('standard', false), emptyPkg('premium', false)]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [helper, setHelper] = useState(false);
  const [hp, setHp] = useState({ service: '', audience: '', benefit: '', includes: '' });

  useEffect(() => {
    if (!user) return;
    supabase.from('portfolio_items').select('*').eq('freelancer_id', user.id).then(({ data }) => setPortfolio((data as PortfolioItem[]) ?? []));
    if (isNew) return;
    (async () => {
      const { data, error } = await supabase.from('gigs').select('*, gig_packages(*)').eq('id', id).maybeSingle();
      if (error || !data || data.freelancer_id !== user.id) { toast.error(error ?? 'Gig not found'); nav('/app/gigs'); return; }
      const gig = data as Gig;
      setG({ title: gig.title, category_id: gig.category_id ?? '', subcategory_id: gig.subcategory_id ?? '', description: gig.description, tags: gig.tags, cover_url: gig.cover_url,
        gallery: gig.gallery, requirements: gig.requirements ?? '', faqs: gig.faqs, extras: gig.extras, portfolio_ids: gig.portfolio_ids, status: gig.status });
      setPkgs((['basic', 'standard', 'premium'] as const).map((t) => {
        const p = gig.gig_packages?.find((x) => x.tier === t);
        return p ? { ...p, enabled: true } : emptyPkg(t, false);
      }));
      setLoading(false);
    })();
  }, [id, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (profile?.role !== 'freelancer') return <EmptyState title="Only freelancers can create gigs" text="Switch your account type in Settings to start selling." action={<ButtonLink to="/app/settings">Settings</ButtonLink>} />;
  if (loading) return <PageLoader />;

  const up = (k: keyof typeof g, v: unknown) => setG((x) => ({ ...x, [k]: v }));
  const upPkg = (i: number, k: keyof PkgDraft, v: unknown) => setPkgs((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  const validate = (): string | null => {
    if (g.title.trim().length < 15) return 'Title must be at least 15 characters';
    if (!g.category_id) return 'Choose a category';
    if (g.description.trim().length < 120) return 'Description must be at least 120 characters';
    const enabled = pkgs.filter((p) => p.enabled);
    if (!enabled.find((p) => p.tier === 'basic')) return 'The Basic package is required';
    for (const p of enabled) {
      if (p.name.trim().length < 2) return `Name your ${p.tier} package`;
      if (!(p.price >= 500)) return `${p.name}: minimum price is PKR 500`;
      if (!(p.delivery_days >= 1 && p.delivery_days <= 90)) return `${p.name}: delivery must be 1–90 days`;
    }
    return null;
  };

  const save = async (publish: boolean) => {
    const err = validate();
    if (err) return toast.error(err);
    if (publish && !g.cover_url) return toast.error('Add a cover image before publishing');
    if (publish) {
      const req = gigChecklist(g, pkgs).filter((c) => c.required && !c.ok);
      if (req.length) return toast.error(`Before publishing: ${req.map((c) => c.label.toLowerCase()).join(', ')}`);
    }
    setSaving(true);
    try {
      const body = {
        title: g.title.trim(), category_id: g.category_id || null, subcategory_id: g.subcategory_id || null, description: g.description.trim(), tags: g.tags,
        cover_url: g.cover_url || null, gallery: g.gallery, requirements: g.requirements.trim() || null, portfolio_ids: g.portfolio_ids,
        faqs: g.faqs.filter((f) => f.q.trim() && f.a.trim()), extras: g.extras.filter((x) => x.name.trim() && x.price > 0),
      };
      let gigId = id;
      if (isNew) {
        const { data, error } = await supabase.from('gigs').insert({ ...body, freelancer_id: user!.id }).select('id').single();
        if (error) throw error;
        gigId = data.id;
      } else {
        const { error } = await supabase.from('gigs').update(body).eq('id', id!);
        if (error) throw error;
      }
      for (const p of pkgs) {
        const row = { gig_id: gigId, tier: p.tier, name: p.name.trim(), description: p.description?.trim() || null, price: p.price, delivery_days: p.delivery_days, revisions: p.revisions, features: p.features };
        if (p.enabled) {
          const { error } = await supabase.from('gig_packages').upsert(row, { onConflict: 'gig_id,tier' });
          if (error) throw error;
        } else if (p.tier !== 'basic') {
          await supabase.from('gig_packages').delete().eq('gig_id', gigId!).eq('tier', p.tier);
        }
      }
      if (publish) {
        const st = await rpc<GigStatus>('publish_gig', { p_gig_id: gigId });
        toast.success(st === 'published' ? 'Your gig is live!' : 'Submitted for review — we’ll notify you when it’s live');
      } else toast.success('Saved');
      nav(publish ? '/app/gigs' : `/app/gigs/${gigId}/edit`, { replace: true });
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const addMedia = async (files: FileList | null, target: 'cover' | 'gallery') => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const url = await uploadPublic('gig-media', user!.id, f);
        if (target === 'cover') up('cover_url', url);
        else setG((x) => ({ ...x, gallery: [...x.gallery, url].slice(0, 8) }));
      }
    } catch (e) { toast.error(e); } finally { setUploading(false); }
  };

  const steps = ['Overview', 'Packages', 'Media', 'Details'];
  const checks = gigChecklist(g, pkgs);
  const score = qualityScore(checks);
  return (
    <div className="grid max-w-6xl gap-6 xl:grid-cols-[1fr_280px]">
    <div className="min-w-0">
      <PageHeader title={isNew ? 'Create a gig' : 'Edit gig'} subtitle={!isNew && g.status === 'published' ? 'Editing title, description or images sends the gig back for a quick review.' : undefined}
        action={!isNew && <Link to={`/gigs/${id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand"><Eye className="h-4 w-4" />Preview</Link>} />
      <div className="mb-6 grid grid-cols-4 gap-2">
        {steps.map((s, i) => (
          <button key={s} onClick={() => setStep(i)} className={cn('rounded-xl border-b-4 px-2 py-2 text-left text-xs font-medium sm:text-sm', step === i ? 'border-brand text-brand' : 'border-slate-200 text-muted dark:border-navy-700')}>
            <span className="hidden sm:inline">{i + 1}. </span>{s}
          </button>
        ))}
      </div>

      <Card className="p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-3 text-sm dark:bg-brand/10">
              <span className="text-brand-700 dark:text-brand-200">Not sure what to write? Get a strong title and description in seconds.</span>
              <Button size="sm" variant="outline" onClick={() => setHelper(true)}><Wand2 className="h-4 w-4" />Writing helper</Button>
            </div>
            <Input label="Gig title" placeholder="I will design a modern minimalist logo for your brand" value={g.title} onChange={(e) => up('title', e.target.value)} maxLength={120} hint={`${g.title.length}/120 · start with “I will…”`} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Category" value={g.category_id} onChange={(e) => { up('category_id', e.target.value); up('subcategory_id', ''); }} required>
                <option value="">Select…</option>{parents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label="Subcategory" value={g.subcategory_id} onChange={(e) => up('subcategory_id', e.target.value)} disabled={!childrenOf(g.category_id).length}>
                <option value="">{childrenOf(g.category_id).length ? 'Select…' : 'None'}</option>{childrenOf(g.category_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <Textarea label="Description" rows={10} value={g.description} onChange={(e) => up('description', e.target.value)} maxLength={8000} hint={`${g.description.length}/8000 · minimum 120. Explain what's included, your process and why you.`} required />
            <TagInput label="Search tags" value={g.tags} onChange={(v) => up('tags', v)} max={10} hint="Keywords clients would search for (max 10)" />
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 lg:grid-cols-3">
            {pkgs.map((p, i) => (
              <div key={p.tier} className={cn('rounded-2xl border p-4', p.enabled ? 'border-brand/40' : 'border-slate-200 opacity-70 dark:border-navy-700')}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-heading font-semibold capitalize">{p.tier}</span>
                  {p.tier !== 'basic' && <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-brand" checked={p.enabled} onChange={(e) => upPkg(i, 'enabled', e.target.checked)} />Offer</label>}
                </div>
                <fieldset disabled={!p.enabled} className="space-y-3">
                  <Input label="Name" value={p.name} onChange={(e) => upPkg(i, 'name', e.target.value)} maxLength={60} />
                  <Textarea label="What's included" rows={3} value={p.description ?? ''} onChange={(e) => upPkg(i, 'description', e.target.value)} maxLength={500} />
                  <Input label="Price (PKR)" type="number" min={500} value={p.price || ''} onChange={(e) => upPkg(i, 'price', Number(e.target.value))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Delivery (days)" type="number" min={1} max={90} value={p.delivery_days} onChange={(e) => upPkg(i, 'delivery_days', Number(e.target.value))} />
                    <Input label="Revisions" type="number" min={0} max={20} value={p.revisions} onChange={(e) => upPkg(i, 'revisions', Number(e.target.value))} />
                  </div>
                  <TagInput label="Features" value={p.features} onChange={(v) => upPkg(i, 'features', v)} max={8} placeholder="Source file, 3 concepts…" />
                </fieldset>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium">Cover image <span className="text-red-500">*</span></p>
              {g.cover_url ? (
                <div className="relative w-full max-w-md overflow-hidden rounded-xl">
                  <img src={g.cover_url} alt="" className="aspect-[16/10] w-full object-cover" />
                  <button onClick={() => up('cover_url', null)} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 dark:bg-navy-800" aria-label="Remove cover"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <label className="flex aspect-[16/10] w-full max-w-md cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm text-muted hover:border-brand dark:border-navy-700">
                  <ImageIcon className="h-8 w-8" />{uploading ? 'Uploading…' : 'Upload cover (1280×800 recommended)'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => addMedia(e.target.files, 'cover')} />
                </label>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Gallery — images or short videos (up to 8)</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {g.gallery.map((u) => (
                  <div key={u} className="relative overflow-hidden rounded-xl">
                    {/\.(mp4|webm)$/i.test(u) ? <video src={u} className="aspect-video w-full object-cover" /> : <img src={u} alt="" className="aspect-video w-full object-cover" />}
                    <button onClick={() => up('gallery', g.gallery.filter((x) => x !== u))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 dark:bg-navy-800" aria-label="Remove"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {g.gallery.length < 8 && (
                  <label className="flex aspect-video cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-muted hover:border-brand dark:border-navy-700">
                    <Upload className="h-5 w-5" /><input type="file" accept="image/*,video/mp4,video/webm" multiple className="hidden" onChange={(e) => addMedia(e.target.files, 'gallery')} />
                  </label>
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Portfolio samples</p>
              {portfolio.length === 0 ? <p className="text-sm text-muted">No portfolio items yet. <Link to="/app/portfolio" className="text-brand">Add some</Link>.</p> : (
                <div className="flex flex-wrap gap-2">
                  {portfolio.map((p) => {
                    const on = g.portfolio_ids.includes(p.id);
                    return <button key={p.id} type="button" onClick={() => up('portfolio_ids', on ? g.portfolio_ids.filter((x) => x !== p.id) : [...g.portfolio_ids, p.id].slice(0, 6))}
                      className={cn('rounded-xl border px-3 py-1.5 text-sm', on ? 'border-brand bg-brand-50 text-brand dark:bg-brand/10' : 'border-slate-300 dark:border-navy-700')}>{p.title}</button>;
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <Textarea label="Requirements from the client" rows={4} value={g.requirements} onChange={(e) => up('requirements', e.target.value)} maxLength={3000}
              hint="What do you need to start? e.g. brand name, colours, examples you like." />
            <div>
              <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">Optional extras</p>
                <button type="button" onClick={() => up('extras', [...g.extras, { name: '', price: 0 }])} className="inline-flex items-center gap-1 text-sm font-medium text-brand"><Plus className="h-4 w-4" />Add extra</button></div>
              {g.extras.map((x, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <input placeholder="Extra (e.g. Fast delivery)" value={x.name} maxLength={80} onChange={(e) => up('extras', g.extras.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900" />
                  <input placeholder="PKR" type="number" min={0} value={x.price || ''} onChange={(e) => up('extras', g.extras.map((y, j) => (j === i ? { ...y, price: Number(e.target.value) } : y)))} className="h-10 w-24 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900" />
                  <input placeholder="+days" type="number" min={0} value={x.days ?? ''} onChange={(e) => up('extras', g.extras.map((y, j) => (j === i ? { ...y, days: Number(e.target.value) || undefined } : y)))} className="h-10 w-20 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900" />
                  <button type="button" onClick={() => up('extras', g.extras.filter((_, j) => j !== i))} aria-label="Remove extra"><Trash2 className="h-4 w-4 text-muted" /></button>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">FAQ</p>
                <button type="button" onClick={() => up('faqs', [...g.faqs, { q: '', a: '' }])} className="inline-flex items-center gap-1 text-sm font-medium text-brand"><Plus className="h-4 w-4" />Add question</button></div>
              {g.faqs.map((f, i) => (
                <div key={i} className="mb-3 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-navy-700">
                  <div className="flex gap-2">
                    <input placeholder="Question" value={f.q} maxLength={200} onChange={(e) => up('faqs', g.faqs.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)))} className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900" />
                    <button type="button" onClick={() => up('faqs', g.faqs.filter((_, j) => j !== i))} aria-label="Remove question"><Trash2 className="h-4 w-4 text-muted" /></button>
                  </div>
                  <textarea placeholder="Answer" value={f.a} maxLength={1000} onChange={(e) => up('faqs', g.faqs.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)))} className="min-h-[70px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-navy-700">
          <div className="flex gap-2">
            {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
            {step < 3 && <Button variant="outline" onClick={() => setStep(step + 1)}>Next</Button>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" loading={saving} onClick={() => save(false)}>Save draft</Button>
            <Button loading={saving} onClick={() => save(true)}><Send className="h-4 w-4" />{g.status === 'published' ? 'Save & resubmit' : 'Publish'}</Button>
          </div>
        </div>
      </Card>
    </div>
      <aside>
        <Card className="sticky top-24 p-5">
          <div className="flex items-center justify-between"><p className="font-heading font-semibold">Gig quality</p><Badge tone={score >= 80 ? 'green' : score >= 55 ? 'amber' : 'red'}>{score}%</Badge></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-700"><div className={cn('h-full rounded-full transition-all', score >= 80 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${score}%` }} /></div>
          <ul className="mt-4 space-y-2.5">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-2 text-sm" title={c.tip}>
                {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className={cn('mt-0.5 h-4 w-4 shrink-0', c.required ? 'text-red-400' : 'text-slate-300 dark:text-navy-700')} />}
                <span><span className={cn(c.ok && 'text-muted line-through decoration-slate-300')}>{c.label}</span>{c.required && !c.ok && <span className="text-xs text-red-500"> · required</span>}
                  {!c.ok && <span className="block text-xs text-muted">{c.tip}</span>}</span>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
      <Modal open={helper} onClose={() => setHelper(false)} title="Writing helper" wide>
        <div className="space-y-4">
          <p className="text-sm text-muted">Answer three quick questions — we’ll draft a title and description you can edit.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input id="hp-service" label="What do you offer?" placeholder="logo design" value={hp.service} onChange={(e) => setHp({ ...hp, service: e.target.value })} />
            <Input id="hp-aud" label="For whom?" placeholder="restaurants and cafes" value={hp.audience} onChange={(e) => setHp({ ...hp, audience: e.target.value })} />
            <Input id="hp-ben" label="Main benefit" placeholder="customers remember" value={hp.benefit} onChange={(e) => setHp({ ...hp, benefit: e.target.value })} />
          </div>
          <Input id="hp-inc" label="What’s included (comma separated)" placeholder="3 concepts, source files, social media kit" value={hp.includes} onChange={(e) => setHp({ ...hp, includes: e.target.value })} />
          <div>
            <p className="mb-2 text-sm font-medium">Pick a title</p>
            <div className="space-y-2">
              {suggestTitles(hp.service, hp.audience, hp.benefit).map((t) => (
                <button key={t} type="button" onClick={() => { up('title', t); toast.success('Title added'); }} className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand hover:bg-brand-50 dark:border-navy-700 dark:hover:bg-brand/10">{t}</button>
              ))}
            </div>
          </div>
          <Button className="w-full" variant="outline" onClick={() => {
            up('description', suggestDescription({ service: hp.service, audience: hp.audience, years: profile?.years_experience, skills: profile?.skills, includes: hp.includes.split(',').map((x) => x.trim()) }));
            if (!g.tags.length && hp.service) up('tags', hp.service.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 5));
            setHelper(false); toast.success('Description drafted — review and personalise it');
          }}><Wand2 className="h-4 w-4" />Use this description draft</Button>
          <p className="text-xs text-muted">Always edit the draft so it describes your real experience and work.</p>
        </div>
      </Modal>
    </div>
  );
}

export function Portfolio() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => q(supabase.from('portfolio_items').select('*').eq('freelancer_id', user!.id).order('created_at', { ascending: false })) as Promise<PortfolioItem[]>, [user?.id]);
  const blank = { id: '', title: '', description: '', link_url: '', media: [] as PortfolioItem['media'], is_published: true };
  const [edit, setEdit] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files || !edit) return;
    setBusy(true);
    try {
      const add: PortfolioItem['media'] = [];
      for (const f of Array.from(files)) add.push({ url: await uploadPublic('portfolio', user!.id, f), type: f.type.startsWith('video/') ? 'video' : 'image' });
      setEdit({ ...edit, media: [...edit.media, ...add].slice(0, 10) });
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!edit) return;
    if (edit.title.trim().length < 3) return toast.error('Add a title');
    if (edit.link_url && !/^https?:\/\//i.test(edit.link_url)) return toast.error('Link must start with http:// or https://');
    setBusy(true);
    const row = { freelancer_id: user!.id, title: edit.title.trim(), description: edit.description.trim() || null, link_url: edit.link_url.trim() || null, media: edit.media, is_published: edit.is_published };
    const { error } = edit.id ? await supabase.from('portfolio_items').update(row).eq('id', edit.id) : await supabase.from('portfolio_items').insert(row);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success('Saved'); setEdit(null); reload();
  };
  const remove = async (id: string) => {
    if (!(await askConfirm('Delete this portfolio item?', { danger: true, confirmLabel: 'Delete' }))) return;
    const { error } = await supabase.from('portfolio_items').delete().eq('id', id);
    if (error) toast.error(error); else { toast.success('Deleted'); reload(); }
  };
  const togglePub = async (p: PortfolioItem) => {
    const { error } = await supabase.from('portfolio_items').update({ is_published: !p.is_published }).eq('id', p.id);
    if (error) toast.error(error); else reload();
  };

  return (
    <div>
      <PageHeader title="Portfolio" subtitle="Show your best work. Published items appear on your public profile." action={!edit && <Button onClick={() => setEdit(blank)}><Plus className="h-4 w-4" />Add project</Button>} />
      {edit && (
        <Card className="mb-6 space-y-4 p-6">
          <Input label="Project title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={100} required />
          <Textarea label="Description" rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} maxLength={2000} />
          <Input label="Link (optional)" placeholder="https://" value={edit.link_url} onChange={(e) => setEdit({ ...edit, link_url: e.target.value })} />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {edit.media.map((m) => (
              <div key={m.url} className="relative overflow-hidden rounded-xl">
                {m.type === 'video' ? <video src={m.url} className="aspect-square w-full object-cover" /> : <img src={m.url} alt="" className="aspect-square w-full object-cover" />}
                <button onClick={() => setEdit({ ...edit, media: edit.media.filter((x) => x.url !== m.url) })} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 dark:bg-navy-800" aria-label="Remove"><X className="h-3 w-3" /></button>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-muted hover:border-brand dark:border-navy-700">
              {busy ? '…' : <Upload className="h-5 w-5" />}<input type="file" multiple accept="image/*,video/mp4,video/webm" className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={edit.is_published} onChange={(e) => setEdit({ ...edit, is_published: e.target.checked })} />Show on my public profile</label>
          <div className="flex gap-2"><Button onClick={save} loading={busy}>Save</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </Card>
      )}
      {loading ? <PageLoader /> : !data?.length && !edit ? <EmptyState icon={ImageIcon} title="No portfolio items yet" text="Add images, videos and links to past work." /> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data?.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              {p.media[0] ? (p.media[0].type === 'video' ? <video src={p.media[0].url} className="aspect-video w-full object-cover" /> : <img src={p.media[0].url} alt="" className="aspect-video w-full object-cover" />)
                : <div className="flex aspect-video items-center justify-center bg-slate-100 text-muted dark:bg-navy-700"><ImageIcon className="h-6 w-6" /></div>}
              <div className="p-4">
                <div className="flex items-center gap-2"><p className="flex-1 truncate font-medium">{p.title}</p>{!p.is_published && <Badge>Hidden</Badge>}</div>
                <div className="mt-3 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEdit({ id: p.id, title: p.title, description: p.description ?? '', link_url: p.link_url ?? '', media: p.media, is_published: p.is_published })}><Pencil className="h-4 w-4" />Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => togglePub(p)}>{p.is_published ? <><EyeOff className="h-4 w-4" />Hide</> : <><Eye className="h-4 w-4" />Publish</>}</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
