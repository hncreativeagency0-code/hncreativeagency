import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Heart, Flag, MapPin } from 'lucide-react';
import type { Gig, Profile } from '@/lib/types';
import { Avatar, Badge, Button, Card, Modal, SafeImg, Select, Stars, Textarea, VerifiedBadge } from './ui';
import { SellerBadges } from './marketing';
import { money, cn, ORDER_STATUS, PAYMENT_STATUS } from '@/lib/utils';
import type { OrderStatus, PaymentStatus } from '@/lib/types';
import { supabase, errorMessage } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export function GigCard({ gig, favorite, onToggleFavorite }: { gig: Gig; favorite?: boolean; onToggleFavorite?: () => void }) {
  return (
    <Card className="group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={`/gigs/${gig.id}`} className="relative block aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-navy-700">
        {gig.cover_url ? (
          <SafeImg src={gig.cover_url} alt={gig.title} label={gig.category?.name ?? 'HN Creative'} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : <div className="flex h-full items-center justify-center text-sm text-muted">No image</div>}
      </Link>
      {onToggleFavorite && (
        <button onClick={onToggleFavorite} aria-label={favorite ? 'Remove from saved' : 'Save gig'}
          className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow transition hover:scale-110 dark:bg-navy-800/90">
          <Heart className={cn('h-4 w-4', favorite ? 'fill-red-500 text-red-500' : 'text-navy dark:text-white')} />
        </button>
      )}
      <div className="flex flex-1 flex-col p-4">
        {gig.freelancer && (
          <Link to={`/freelancers/${gig.freelancer.id}`} className="mb-2 flex items-center gap-2">
            <Avatar url={gig.freelancer.avatar_url} name={gig.freelancer.full_name} size={26} />
            <span className="truncate text-sm font-medium text-navy dark:text-slate-100">{gig.freelancer.full_name}</span>
            {gig.freelancer.is_verified && <VerifiedBadge />}
            {gig.freelancer.seller_level === 'top' && <Badge tone="amber" className="ml-auto">Top</Badge>}
            {gig.freelancer.seller_level === 'rising' && <Badge tone="sky" className="ml-auto">Rising</Badge>}
          </Link>
        )}
        <Link to={`/gigs/${gig.id}`} className="line-clamp-2 text-[15px] font-medium leading-snug text-navy hover:text-brand dark:text-white">{gig.title}</Link>
        <div className="mb-3 mt-2"><Stars value={gig.rating_avg} count={gig.rating_count} /></div>
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 dark:border-navy-700">
          <span className="flex items-center gap-1 text-xs text-muted"><Clock className="h-3.5 w-3.5" />{gig.min_delivery_days ?? '—'}d delivery</span>
          <span className="text-right text-xs text-muted">From <span className="font-heading text-base font-semibold text-navy dark:text-white">{money(gig.starting_price)}</span></span>
        </div>
      </div>
    </Card>
  );
}

export function FreelancerCard({ f }: { f: Profile }) {
  return (
    <Card className="flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start gap-3">
        <Avatar url={f.avatar_url} name={f.full_name} size={56} />
        <div className="min-w-0 flex-1">
          <Link to={`/freelancers/${f.id}`} className="flex items-center gap-1 font-heading font-semibold text-navy hover:text-brand dark:text-white">
            <span className="truncate">{f.full_name}</span>{f.is_verified && <VerifiedBadge />}
          </Link>
          <p className="truncate text-sm text-muted">{f.title || 'Freelancer'}</p>
          <div className="mt-1"><Stars value={f.rating_avg} count={f.rating_count} /></div>
        </div>
      </div>
      <SellerBadges p={f} className="mt-3" />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {f.skills.slice(0, 4).map((s) => <Badge key={s}>{s}</Badge>)}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm dark:border-navy-700">
        <span className="flex items-center gap-1 text-muted"><MapPin className="h-3.5 w-3.5" />{f.city || f.country || '—'}</span>
        <AvailabilityBadge a={f.availability} />
      </div>
      {f.hourly_rate ? <p className="mt-2 text-sm text-muted">From <span className="font-semibold text-navy dark:text-white">{money(f.hourly_rate)}</span>/hr</p> : null}
    </Card>
  );
}

export function AvailabilityBadge({ a }: { a: Profile['availability'] }) {
  return a === 'available' ? <Badge tone="green">Available</Badge> : a === 'busy' ? <Badge tone="amber">Busy</Badge> : <Badge>Away</Badge>;
}

export const OrderStatusBadge = ({ s }: { s: OrderStatus }) => <Badge tone={ORDER_STATUS[s].tone}>{ORDER_STATUS[s].label}</Badge>;
export const PaymentStatusBadge = ({ s }: { s: PaymentStatus }) => <Badge tone={PAYMENT_STATUS[s].tone}>{PAYMENT_STATUS[s].label}</Badge>;

const REASONS = [
  ['spam', 'Spam'], ['scam', 'Scam or fraud'], ['inappropriate', 'Inappropriate content'], ['copyright', 'Copyright violation'],
  ['harassment', 'Harassment'], ['off_platform_payment', 'Asking to pay outside the platform'], ['other', 'Other'],
] as const;

export function ReportButton({ type, id, label = 'Report', className }: { type: 'gig' | 'user' | 'review' | 'message'; id: string; label?: string; className?: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from('reports').insert({ reporter_id: user.id, target_type: type, target_id: id, reason, details: details || null });
    setBusy(false);
    if (error) return toast.error(/duplicate|unique/i.test(error.message) ? 'You already reported this.' : errorMessage(error));
    toast.success('Thanks — our team will review this report.');
    setOpen(false); setDetails('');
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className={cn('inline-flex items-center gap-1 text-xs text-muted hover:text-red-500', className)}><Flag className="h-3.5 w-3.5" />{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report">
        <div className="space-y-4">
          <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Textarea label="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} />
          <Button className="w-full" loading={busy} onClick={submit}>Submit report</Button>
        </div>
      </Modal>
    </>
  );
}
