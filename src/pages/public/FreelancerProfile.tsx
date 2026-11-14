import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapPin, Clock, Languages, GraduationCap, Award, MessageSquare, FileText, Bookmark, ExternalLink, Briefcase } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAsync, useFavorites, q } from '@/lib/hooks';
import type { Gig, PortfolioItem, Profile, Review } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Avatar, Badge, Button, Card, EmptyState, ErrorBox, Input, Modal, PageLoader, Stars, Textarea, VerifiedBadge } from '@/components/ui';
import { SellerBadges } from '@/components/marketing';
import { useSeo } from '@/lib/seo';
import { AvailabilityBadge, GigCard, ReportButton } from '@/components/cards';
import { date, money } from '@/lib/utils';
import { uploadFile } from '@/lib/storage';
import { GIG_SELECT } from './Home';
import { ReviewList, useStartChat } from './GigDetail';

function CustomRequestModal({ freelancer, open, onClose }: { freelancer: Profile; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ title: '', description: '', budget: '', deadline: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (f.title.trim().length < 5) return toast.error('Give your project a title (5+ characters)');
    if (f.description.trim().length < 20) return toast.error('Describe the project (20+ characters)');
    setBusy(true);
    try {
      const conv = await rpc<string>('start_conversation', { p_other: freelancer.id });
      const attachments = [];
      for (const file of files.slice(0, 5)) attachments.push(await uploadFile('chat-files', `${conv}/${user!.id}`, file));
      await rpc('send_custom_request', {
        p_freelancer: freelancer.id, p_title: f.title.trim(), p_description: f.description.trim(),
        p_budget: f.budget ? Number(f.budget) : null, p_deadline: f.deadline || null, p_attachments: attachments,
      });
      toast.success('Request sent');
      nav(`/app/messages/${conv}`);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Request a custom offer from ${freelancer.full_name.split(' ')[0]}`} wide>
      <div className="space-y-4">
        <Input label="Project title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} required />
        <Textarea label="Description" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={5000} required hint="Goals, deliverables, references, style…" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Budget (PKR)" type="number" min={500} value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
          <Input label="Deadline" type="date" min={new Date().toISOString().slice(0, 10)} value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Attachments (optional, up to 5)</label>
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="text-sm" />
        </div>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>Send request</Button>
      </div>
    </Modal>
  );
}

export default function FreelancerProfile() {
  const { id } = useParams();
  const { user, profile: me } = useAuth();
  const toast = useToast();
  const fav = useFavorites();
  const chat = useStartChat();
  const [reqOpen, setReqOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const p = await q(supabase.from('profiles').select('*').eq('id', id!).maybeSingle()) as Profile | null;
    if (!p || p.role !== 'freelancer') return null;
    const [gigs, portfolio, reviews] = await Promise.all([
      q(supabase.from('gigs').select(GIG_SELECT).eq('freelancer_id', p.id).eq('status', 'published').order('published_at', { ascending: false })),
      q(supabase.from('portfolio_items').select('*').eq('freelancer_id', p.id).eq('is_published', true).order('created_at', { ascending: false })),
      q(supabase.from('reviews').select('*, client:profiles!reviews_client_id_fkey(full_name,avatar_url)').eq('freelancer_id', p.id).eq('is_hidden', false).order('created_at', { ascending: false }).limit(30)),
    ]);
    return { p, gigs: gigs as Gig[], portfolio: portfolio as PortfolioItem[], reviews: reviews as Review[] };
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    supabase.from('saved_freelancers').select('freelancer_id').eq('user_id', user.id).eq('freelancer_id', id).maybeSingle().then(({ data }) => setSaved(!!data));
  }, [user, id]);

  const toggleSave = async () => {
    if (!user) return;
    const { error } = saved
      ? await supabase.from('saved_freelancers').delete().eq('user_id', user.id).eq('freelancer_id', id!)
      : await supabase.from('saved_freelancers').insert({ user_id: user.id, freelancer_id: id });
    if (error) return toast.error(error);
    setSaved(!saved); toast.success(saved ? 'Removed from saved' : 'Freelancer saved');
  };

  const pp = data?.p;
  useSeo(pp ? {
    title: `${pp.full_name} – ${pp.title || 'Freelancer'}${pp.city ? ` in ${pp.city}` : ''}`,
    description: `${pp.bio?.slice(0, 130) ?? `Hire ${pp.full_name} on HN Creative Agency.`} ${pp.rating_count ? `Rated ${Number(pp.rating_avg).toFixed(1)}/5 from ${pp.rating_count} reviews.` : ''}`,
    path: `/freelancers/${pp.id}`, image: pp.avatar_url, type: 'profile',
    jsonLd: { '@context': 'https://schema.org', '@type': 'Person', name: pp.full_name, jobTitle: pp.title ?? undefined, address: pp.city ? { '@type': 'PostalAddress', addressLocality: pp.city, addressCountry: 'PK' } : undefined, knowsAbout: pp.skills },
  } : { title: loading ? 'Loading…' : 'Freelancer not found', noindex: true });
  if (loading) return <PageLoader />;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorBox message={error} onRetry={reload} /></div>;
  if (!data) return <div className="mx-auto max-w-3xl p-6"><EmptyState title="Freelancer not found" /></div>;
  const { p, gigs, portfolio, reviews } = data;
  const isMe = user?.id === p.id;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-5">
          <Card className="p-6 text-center">
            <div className="flex justify-center"><Avatar url={p.avatar_url} name={p.full_name} size={104} /></div>
            <h1 className="mt-4 flex items-center justify-center gap-1.5 font-heading text-xl font-semibold">{p.full_name}{p.is_verified && <VerifiedBadge />}</h1>
            <p className="text-sm text-muted">{p.title || 'Freelancer'}</p>
            <div className="mt-2 flex justify-center"><Stars value={p.rating_avg} count={p.rating_count} /></div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5"><AvailabilityBadge a={p.availability} /><SellerBadges p={p} /></div>
            {p.status === 'suspended' && <Badge tone="red" className="mt-2">Account unavailable</Badge>}
            {!isMe && me?.role !== 'freelancer' && p.status === 'active' && (
              <div className="mt-5 space-y-2">
                <Button className="w-full" onClick={() => chat.start(p.id)} loading={chat.busy}><MessageSquare className="h-4 w-4" />Contact me</Button>
                <Button variant="outline" className="w-full" onClick={() => (user ? setReqOpen(true) : chat.start(p.id))}><FileText className="h-4 w-4" />Request custom offer</Button>
                {user && <Button variant="ghost" className="w-full" onClick={toggleSave}><Bookmark className={saved ? 'h-4 w-4 fill-brand text-brand' : 'h-4 w-4'} />{saved ? 'Saved' : 'Save freelancer'}</Button>}
              </div>
            )}
            {isMe && <Link to="/app/settings" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 text-sm font-medium dark:border-navy-700">Edit profile</Link>}
          </Card>
          <Card className="space-y-3 p-5 text-sm">
            {(p.city || p.country) && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted" />{[p.city, p.country].filter(Boolean).join(', ')}</p>}
            <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted" />Member since {date(p.created_at)}</p>
            <p className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted" />{p.completed_orders} completed order{p.completed_orders === 1 ? '' : 's'}</p>
            {p.years_experience != null && <p className="flex items-center gap-2"><Award className="h-4 w-4 text-muted" />{p.years_experience} year{p.years_experience === 1 ? '' : 's'} experience</p>}
            {p.languages.length > 0 && <p className="flex items-center gap-2"><Languages className="h-4 w-4 text-muted" />{p.languages.join(', ')}</p>}
            {p.hourly_rate ? <p className="pt-1 font-medium">From {money(p.hourly_rate)} / hour</p> : null}
          </Card>
          {p.skills.length > 0 && (
            <Card className="p-5"><h3 className="font-heading font-semibold">Skills</h3><div className="mt-3 flex flex-wrap gap-1.5">{p.skills.map((s) => <Badge key={s}>{s}</Badge>)}</div></Card>
          )}
          {(p.education.length > 0 || p.certifications.length > 0) && (
            <Card className="space-y-4 p-5 text-sm">
              {p.education.length > 0 && <div><h3 className="flex items-center gap-2 font-heading font-semibold"><GraduationCap className="h-4 w-4 text-brand" />Education</h3>
                {p.education.map((e, i) => <p key={i} className="mt-2"><span className="font-medium">{e.degree}</span><br /><span className="text-muted">{e.school}{e.year ? ` · ${e.year}` : ''}</span></p>)}</div>}
              {p.certifications.length > 0 && <div><h3 className="flex items-center gap-2 font-heading font-semibold"><Award className="h-4 w-4 text-brand" />Certifications</h3>
                {p.certifications.map((c, i) => <p key={i} className="mt-2"><span className="font-medium">{c.name}</span><br /><span className="text-muted">{[c.issuer, c.year].filter(Boolean).join(' · ')}</span></p>)}</div>}
            </Card>
          )}
          {!isMe && <ReportButton type="user" id={p.id} label="Report this user" />}
        </aside>

        <div className="min-w-0 space-y-10">
          {p.bio && <section><h2 className="font-heading text-xl font-semibold">About</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-navy/80 dark:text-slate-300">{p.bio}</p></section>}
          <section>
            <h2 className="font-heading text-xl font-semibold">Gigs</h2>
            {gigs.length ? <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{gigs.map((g) => <GigCard key={g.id} gig={g} favorite={fav.ids.has(g.id)} onToggleFavorite={() => fav.toggle(g.id)} />)}</div>
              : <p className="mt-2 text-sm text-muted">No published gigs yet.</p>}
          </section>
          <section>
            <h2 className="font-heading text-xl font-semibold">Portfolio</h2>
            {portfolio.length ? (
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {portfolio.map((it) => (
                  <Card key={it.id} className="overflow-hidden">
                    {it.media[0] && (it.media[0].type === 'video' ? <video src={it.media[0].url} controls className="aspect-video w-full bg-black" /> : <img src={it.media[0].url} alt={it.title} className="aspect-video w-full object-cover" loading="lazy" />)}
                    {it.media.length > 1 && <div className="flex gap-1 overflow-x-auto px-3 pt-3">{it.media.slice(1).map((m) => m.type === 'image' && <img key={m.url} src={m.url} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />)}</div>}
                    <div className="p-4">
                      <p className="font-medium">{it.title}</p>
                      {it.description && <p className="mt-1 text-sm text-muted">{it.description}</p>}
                      {it.link_url && <a href={it.link_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand">View project<ExternalLink className="h-3.5 w-3.5" /></a>}
                    </div>
                  </Card>
                ))}
              </div>
            ) : <p className="mt-2 text-sm text-muted">No portfolio items yet.</p>}
          </section>
          <section>
            <h2 className="font-heading text-xl font-semibold">Reviews <span className="text-base font-normal text-muted">({p.rating_count})</span></h2>
            <ReviewList reviews={reviews} canRespond={isMe} onChanged={reload} />
          </section>
        </div>
      </div>
      <CustomRequestModal freelancer={p} open={reqOpen} onClose={() => setReqOpen(false)} />
    </div>
  );
}
