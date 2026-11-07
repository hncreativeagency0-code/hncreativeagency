import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, KeyRound, BadgeCheck, Upload, Plus, Trash2, Gift, Copy, Ticket, Clock, CheckCircle2, AlertTriangle, Share2 } from 'lucide-react';
import { supabase, rpc, errorMessage } from '@/lib/supabase';
import { uploadFile } from '@/lib/storage';
import { useAsync, usePublicSettings, q } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { askConfirm } from '@/context/DialogContext';
import type { Coupon, VerificationRequest } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, PageLoader, Textarea } from '@/components/ui';
import { SITE, waLink } from '@/lib/site';
import { date, money, timeAgo } from '@/lib/utils';

/* ----------------------------- Two-step login (TOTP) ----------------------------- */
interface Factor { id: string; friendly_name?: string; factor_type: string; status: string; created_at: string }
export function SecurityTab() {
  const toast = useToast();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { toast.error(error); setFactors([]); return; }
    setFactors(((data?.all ?? data?.totp ?? []) as unknown as Factor[]).filter((f) => f.factor_type === 'totp'));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setBusy(true);
    // Remove any half-finished setup first
    for (const f of (factors ?? []).filter((x) => x.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toLocaleDateString('en-GB')}` });
    setBusy(false);
    if (error || !data) return toast.error(error ?? 'Could not start setup');
    const qr = data.totp.qr_code.startsWith('data:') ? data.totp.qr_code : `data:image/svg+xml;utf-8,${encodeURIComponent(data.totp.qr_code)}`;
    setEnroll({ id: data.id, qr, secret: data.totp.secret }); setCode('');
  };
  const verify = async () => {
    if (!enroll || !/^\d{6}$/.test(code)) return toast.error('Enter the 6-digit code from your authenticator app');
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
    setBusy(false);
    if (error) return toast.error(/invalid|expired/i.test(error.message) ? 'That code didn’t work — check the time on your phone and try the newest code.' : errorMessage(error));
    toast.success('Two-step login is on'); setEnroll(null); load();
  };
  const remove = async (f: Factor) => {
    if (!(await askConfirm('Turn off two-step login? Your account will be protected by your password only.', { danger: true, confirmLabel: 'Turn off' }))) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return toast.error(/aal2|assurance/i.test(error.message) ? 'For your security, sign out and sign in again with your code, then try again.' : errorMessage(error));
    toast.success('Two-step login turned off'); load();
  };
  if (!factors) return <PageLoader />;
  const active = factors.filter((f) => f.status === 'verified');
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-brand-50 p-3 dark:bg-brand/15"><KeyRound className="h-6 w-6 text-brand" /></span>
          <div className="flex-1">
            <h3 className="font-heading font-semibold">Two-step login</h3>
            <p className="mt-1 text-sm text-muted">After your password, we’ll ask for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator or Authy). Even if someone learns your password, they can’t sign in.</p>
            {active.length > 0 ? (
              <div className="mt-4 space-y-2">
                {active.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <span className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300"><ShieldCheck className="h-4 w-4" />On · {f.friendly_name || 'Authenticator app'}</span>
                    <Button size="sm" variant="ghost" onClick={() => remove(f)}>Turn off</Button>
                  </div>
                ))}
              </div>
            ) : !enroll ? (
              <Button className="mt-4" onClick={start} loading={busy}><ShieldCheck className="h-4 w-4" />Turn on two-step login</Button>
            ) : null}
          </div>
        </div>
        {enroll && (
          <div className="mt-6 grid gap-6 rounded-2xl border border-slate-200 p-5 dark:border-navy-700 sm:grid-cols-[180px_1fr]">
            <img src={enroll.qr} alt="QR code for your authenticator app" className="h-44 w-44 rounded-xl bg-white p-2" />
            <div className="space-y-3 text-sm">
              <p><b>1.</b> Open your authenticator app and scan this QR code.</p>
              <p className="text-muted">Can’t scan? Enter this key: <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-navy-900">{enroll.secret}</code></p>
              <p><b>2.</b> Enter the 6-digit code shown in the app.</p>
              <div className="flex max-w-xs gap-2">
                <Input id="mfa-code" aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                <Button onClick={verify} loading={busy}>Verify</Button>
              </div>
              <button className="text-xs text-muted underline" onClick={() => setEnroll(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Card>
      <Card className="p-6 text-sm">
        <h3 className="font-heading font-semibold">Security tips</h3>
        <ul className="mt-2 space-y-1.5 text-muted [&_li]:ml-5 [&_li]:list-disc">
          <li>HN will never ask for your password, OTP or banking PIN on WhatsApp or by phone.</li>
          <li>Use a password you don’t use on any other site.</li>
          <li>Report anyone who asks you to pay or get paid outside HN.</li>
        </ul>
      </Card>
    </div>
  );
}

/* ----------------------------- Freelancer verification ----------------------------- */
export function VerificationTab() {
  const { profile, user } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => q(supabase.from('verification_requests').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5)) as Promise<VerificationRequest[]>, [user?.id]);
  const [legal, setLegal] = useState(profile?.full_name ?? '');
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [links, setLinks] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile || !user) return null;
  if (loading) return <PageLoader />;
  const pending = data?.find((r) => r.status === 'pending');
  const lastRejected = data?.find((r) => r.status === 'rejected');

  if (profile.is_verified) return (
    <Card className="p-8 text-center">
      <BadgeCheck className="mx-auto h-12 w-12 text-brand" />
      <p className="mt-3 font-heading text-xl font-semibold">You’re verified</p>
      <p className="mt-1 text-sm text-muted">The verified badge shows on your profile, gigs and proposals.</p>
    </Card>
  );
  if (pending) return (
    <Card className="p-8 text-center">
      <Clock className="mx-auto h-12 w-12 text-amber-500" />
      <p className="mt-3 font-heading text-xl font-semibold">Verification in review</p>
      <p className="mt-1 text-sm text-muted">Submitted {timeAgo(pending.created_at)}. We usually review within 2 business days and will notify you.</p>
    </Card>
  );
  const okFile = (f: File | null) => !f || (/^(image\/(png|jpeg|webp)|application\/pdf)$/.test(f.type) && f.size <= 10 * 1048576);
  const submit = async () => {
    const urls = links.map((l) => l.trim()).filter(Boolean);
    if (legal.trim().length < 3) return toast.error('Enter your full name exactly as on your CNIC');
    if (!front) return toast.error('Upload a photo of the front of your CNIC');
    if (!okFile(front) || !okFile(back)) return toast.error('CNIC photos must be JPG, PNG, WEBP or PDF under 10 MB');
    if (!urls.length || urls.some((u) => !/^https?:\/\/\S+\.\S+/.test(u))) return toast.error('Add at least one valid link to your work (starting with https://)');
    setBusy(true);
    try {
      const f1 = await uploadFile('verification-docs', user.id, front);
      const f2 = back ? await uploadFile('verification-docs', user.id, back) : null;
      await rpc('submit_verification', { p_legal_name: legal.trim(), p_id_front: f1.path, p_id_back: f2?.path ?? null, p_sample_links: urls, p_notes: notes.trim() || null });
      toast.success('Submitted — we’ll review it within 2 business days'); reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const FileField = ({ id, label, file, set }: { id: string; label: string; file: File | null; set: (f: File | null) => void }) => (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm hover:border-brand dark:border-navy-700">
        <Upload className="h-5 w-5 shrink-0 text-brand" /><span className="min-w-0 flex-1 truncate">{file ? file.name : 'Choose photo or PDF'}</span>
        <input id={id} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => set(e.target.files?.[0] ?? null)} />
      </label>
    </div>
  );
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-brand-50 p-3 dark:bg-brand/15"><BadgeCheck className="h-6 w-6 text-brand" /></span>
          <div><h3 className="font-heading font-semibold">Get the verified badge</h3><p className="mt-1 text-sm text-muted">Verified freelancers get more orders. We check your identity (CNIC) and a few samples of your work. Your documents are private — only our verification team can see them.</p></div>
        </div>
        {lastRejected && <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><AlertTriangle className="h-4 w-4 shrink-0" />Last request needs changes: {lastRejected.admin_note}</div>}
        <div className="mt-6 space-y-4">
          <Input id="ver-name" label="Full name as on CNIC" value={legal} onChange={(e) => setLegal(e.target.value)} maxLength={80} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <FileField id="ver-front" label="CNIC — front *" file={front} set={setFront} />
            <FileField id="ver-back" label="CNIC — back" file={back} set={setBack} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Links to your work *</p>
            <div className="space-y-2">
              {links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input value={l} onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))} placeholder="https://behance.net/yourname" aria-label={`Work link ${i + 1}`}
                    className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900" />
                  {links.length > 1 && <button onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label="Remove link"><Trash2 className="h-4 w-4 text-muted" /></button>}
                </div>
              ))}
              {links.length < 5 && <button onClick={() => setLinks([...links, ''])} className="inline-flex items-center gap-1 text-sm font-medium text-brand"><Plus className="h-4 w-4" />Add link</button>}
            </div>
            <p className="mt-1 text-xs text-muted">Behance, Dribbble, Instagram, YouTube, a live website or Google Drive folder.</p>
          </div>
          <Textarea id="ver-notes" label="Anything else? (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          <Button onClick={submit} loading={busy}>Submit for verification</Button>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- Referrals & credits ----------------------------- */
export function ReferralTab() {
  const { user } = useAuth();
  const toast = useToast();
  const s = usePublicSettings();
  const { data, loading } = useAsync(async () => {
    const [priv, credits] = await Promise.all([
      q(supabase.from('profile_private').select('referral_code').eq('id', user!.id).maybeSingle()) as Promise<{ referral_code: string | null } | null>,
      q(supabase.from('coupons').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false })) as Promise<Coupon[]>,
    ]);
    return { code: priv?.referral_code ?? null, credits };
  }, [user?.id]);
  if (loading) return <PageLoader />;
  const link = data?.code ? `${SITE.url}/register?ref=${data.code}` : '';
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success('Copied'), () => toast.info(t));
  const amount = s?.referral_reward.amount ?? 500;
  return (
    <div className="space-y-6">
      {s?.referral_reward.enabled !== false && (
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <span className="hidden rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-500/15 sm:block"><Gift className="h-6 w-6 text-emerald-600" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading font-semibold">Invite a friend — you both get {money(amount)}</h3>
              <p className="mt-1 text-sm text-muted">When someone signs up with your link and completes their first order of {money(s?.referral_reward.min_order ?? 2000)} or more, you each get a {money(amount)} credit.</p>
              {link && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <code className="min-w-0 flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900">{link}</code>
                  <Button variant="outline" onClick={() => copy(link)}><Copy className="h-4 w-4" />Copy</Button>
                  <a href={waLink('', `Join me on HN Creative Agency — Pakistan’s safe freelance marketplace. Sign up with my link and we both get ${money(amount)} credit: ${link}`)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-medium text-white"><Share2 className="h-4 w-4" />WhatsApp</a>
                </div>
              )}
              {data?.code && <p className="mt-2 text-xs text-muted">Your code: <b className="font-mono">{data.code}</b></p>}
            </div>
          </div>
        </Card>
      )}
      <Card className="p-6">
        <h3 className="flex items-center gap-2 font-heading font-semibold"><Ticket className="h-4 w-4 text-brand" />Your credits</h3>
        <p className="mt-1 text-sm text-muted">Enter a code at checkout. Credits come from referrals and late deliveries.</p>
        {data?.credits.length ? (
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-navy-700">
            {data.credits.map((c) => {
              const used = c.max_uses != null && c.used_count >= c.max_uses;
              const expired = c.expires_at && new Date(c.expires_at) < new Date();
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <code className="rounded-lg bg-brand-50 px-2 py-1 font-mono font-semibold text-brand-700 dark:bg-brand/15 dark:text-brand-200">{c.code}</code>
                  <span className="flex-1">{c.kind === 'amount' ? money(c.value) : `${Number(c.value)}%`} off · {c.description}</span>
                  {used ? <Badge>Used</Badge> : expired ? <Badge>Expired</Badge> : <><Badge tone="green"><CheckCircle2 className="h-3 w-3" />Available</Badge>{c.expires_at && <span className="text-xs text-muted">until {date(c.expires_at)}</span>}<button onClick={() => copy(c.code)} aria-label="Copy code"><Copy className="h-4 w-4 text-muted hover:text-brand" /></button></>}
                </li>
              );
            })}
          </ul>
        ) : <div className="mt-4"><EmptyState icon={Ticket} title="No credits yet" text="First order? Use WELCOME10 for 10% off." action={<Link to="/explore" className="text-sm font-medium text-brand">Browse services →</Link>} /></div>}
      </Card>
    </div>
  );
}
