import { askConfirm } from '@/context/DialogContext';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ReferralTab, SecurityTab, VerificationTab } from './SettingsExtra';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { supabase, errorMessage } from '@/lib/supabase';
import { uploadPublic } from '@/lib/storage';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import type { Profile } from '@/lib/types';
import { Avatar, Button, Card, Input, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import { TagInput } from '@/components/TagInput';
import { cn } from '@/lib/utils';

export function ProfileForm({ onSaved, submitLabel = 'Save profile' }: { onSaved?: () => void; submitLabel?: string }) {
  const { profile, refreshProfile, user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState<Profile>(profile!);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (profile) setF(profile); }, [profile]);
  if (!profile) return null;
  const isFreelancer = f.role === 'freelancer';
  const upd = <K extends keyof Profile>(k: K, v: Profile[K]) => setF((x) => ({ ...x, [k]: v }));

  const onAvatar = async (file?: File) => {
    if (!file || !user) return;
    setUploading(true);
    try { upd('avatar_url', await uploadPublic('avatars', user.id, file)); toast.info('Photo uploaded — remember to save'); }
    catch (e) { toast.error(e); } finally { setUploading(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.full_name.trim().length < 2) er.full_name = 'Enter your name';
    if (isFreelancer) {
      if (!f.title || f.title.trim().length < 5) er.title = 'Add a professional title (5+ characters)';
      if (!f.bio || f.bio.trim().length < 80) er.bio = 'Write at least 80 characters about yourself';
      if (f.skills.length < 1) er.skills = 'Add at least one skill';
    }
    if (f.username && !/^[a-z0-9_]{3,30}$/.test(f.username)) er.username = '3–30 lowercase letters, numbers or _';
    setErrors(er);
    if (Object.keys(er).length) return toast.error('Please fix the highlighted fields');
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      full_name: f.full_name.trim(), username: f.username || null, avatar_url: f.avatar_url, title: f.title?.trim() || null, bio: f.bio?.trim() || null,
      skills: f.skills, years_experience: f.years_experience, languages: f.languages, hourly_rate: f.hourly_rate,
      country: f.country || null, city: f.city || null, availability: f.availability,
      education: f.education.filter((x) => x.school || x.degree), certifications: f.certifications.filter((x) => x.name),
      profile_completed: true,
    }).eq('id', profile.id);
    setBusy(false);
    if (error) return toast.error(/username/.test(error.message) ? 'That username is taken' : errorMessage(error));
    await refreshProfile();
    toast.success('Profile saved');
    onSaved?.();
  };

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <div className="flex items-center gap-4">
        <Avatar url={f.avatar_url} name={f.full_name} size={80} />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:border-brand dark:border-navy-700">
          <Camera className="h-4 w-4" />{uploading ? 'Uploading…' : 'Change photo'}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" value={f.full_name} onChange={(e) => upd('full_name', e.target.value)} error={errors.full_name} maxLength={80} required />
        <Input label="Username (optional)" value={f.username ?? ''} onChange={(e) => upd('username', e.target.value.toLowerCase())} error={errors.username} maxLength={30} />
        <Input label="Country" value={f.country ?? ''} onChange={(e) => upd('country', e.target.value)} maxLength={60} />
        <Input label="City" value={f.city ?? ''} onChange={(e) => upd('city', e.target.value)} maxLength={60} />
      </div>
      {isFreelancer && (
        <>
          <Input label="Professional title" placeholder="e.g. Brand Identity Designer" value={f.title ?? ''} onChange={(e) => upd('title', e.target.value)} error={errors.title} maxLength={100} required />
          <Textarea label="About you" rows={6} value={f.bio ?? ''} onChange={(e) => upd('bio', e.target.value)} error={errors.bio} maxLength={2000} hint={`${(f.bio ?? '').length}/2000`} required />
          <div>
            <TagInput label="Skills" value={f.skills} onChange={(v) => upd('skills', v)} max={15} />
            {errors.skills && <p className="mt-1 text-xs text-red-500">{errors.skills}</p>}
          </div>
          <TagInput label="Languages" value={f.languages} onChange={(v) => upd('languages', v)} max={8} placeholder="English, Urdu…" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Years of experience" type="number" min={0} max={60} value={f.years_experience ?? ''} onChange={(e) => upd('years_experience', e.target.value === '' ? null : Number(e.target.value))} />
            <Input label="Hourly rate (PKR)" type="number" min={0} value={f.hourly_rate ?? ''} onChange={(e) => upd('hourly_rate', e.target.value === '' ? null : Number(e.target.value))} />
            <Select label="Availability" value={f.availability} onChange={(e) => upd('availability', e.target.value as Profile['availability'])}>
              <option value="available">Available</option><option value="busy">Busy</option><option value="away">Away</option>
            </Select>
          </div>
          <ListEditor title="Education" items={f.education} onChange={(v) => upd('education', v)} empty={{ school: '', degree: '', year: '' }}
            fields={[['degree', 'Degree / field'], ['school', 'School'], ['year', 'Year']]} />
          <ListEditor title="Certifications" items={f.certifications} onChange={(v) => upd('certifications', v)} empty={{ name: '', issuer: '', year: '' }}
            fields={[['name', 'Certificate'], ['issuer', 'Issuer'], ['year', 'Year']]} />
        </>
      )}
      <Button type="submit" size="lg" loading={busy}>{submitLabel}</Button>
    </form>
  );
}

function ListEditor<T extends Record<string, string | undefined>>({ title, items, onChange, empty, fields }: {
  title: string; items: T[]; onChange: (v: T[]) => void; empty: T; fields: [keyof T & string, string][];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        {items.length < 6 && <button type="button" onClick={() => onChange([...items, { ...empty }])} className="inline-flex items-center gap-1 text-sm font-medium text-brand"><Plus className="h-4 w-4" />Add</button>}
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            {fields.map(([k, ph]) => (
              <input key={k} placeholder={ph} value={it[k] ?? ''} maxLength={100}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                className={cn('h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900', k === 'year' ? 'w-20' : 'flex-1')} />
            ))}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="px-2 text-muted hover:text-red-500" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Onboarding() {
  const { profile } = useAuth();
  const nav = useNavigate();
  if (!profile) return null;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Complete your profile" subtitle={profile.role === 'freelancer'
        ? 'Clients see this on your public profile. A complete profile helps you get orders.' : 'Just a few details and you can start hiring.'} />
      <Card className="p-6"><ProfileForm submitLabel="Save and continue" onSaved={() => nav(profile.role === 'freelancer' ? '/app/gigs/new' : '/explore')} /></Card>
    </div>
  );
}

function AccountTab() {
  const { profile, user, refreshProfile } = useAuth();
  const toast = useToast();
  const { mode, setMode } = useTheme();
  const [priv, setPriv] = useState({ phone: '', whatsapp: '', email_notifications: true, whatsapp_notifications: false });
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!user) return;
    supabase.from('profile_private').select('phone,whatsapp,email_notifications,whatsapp_notifications').eq('id', user.id).maybeSingle()
      .then(({ data }) => data && setPriv({ phone: data.phone ?? '', whatsapp: data.whatsapp ?? '', email_notifications: data.email_notifications, whatsapp_notifications: !!data.whatsapp_notifications }));
  }, [user]);
  if (!profile || !user) return null;

  const savePrivate = async () => {
    setBusy('priv');
    if (priv.whatsapp_notifications && !/^(\+?92|0)3\d{9}$/.test(priv.whatsapp.replace(/[\s-]/g, ''))) { setBusy(''); return toast.error('Enter your WhatsApp number (e.g. 0300 1234567) to get WhatsApp alerts'); }
    const { error } = await supabase.from('profile_private').update({ phone: priv.phone || null, whatsapp: priv.whatsapp || null, email_notifications: priv.email_notifications, whatsapp_notifications: priv.whatsapp_notifications }).eq('id', user.id);
    setBusy('');
    if (error) toast.error(error); else toast.success('Saved');
  };
  const setOnline = async (v: boolean) => {
    const { error } = await supabase.from('profiles').update({ show_online_status: v }).eq('id', user.id);
    if (error) return toast.error(error);
    await refreshProfile(); toast.success(v ? 'Online status visible' : 'Online status hidden');
  };
  const changePw = async () => {
    if (pw.length < 8 || !/\d/.test(pw)) return toast.error('At least 8 characters including a number');
    setBusy('pw');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy('');
    if (error) return toast.error(error);
    setPw(''); toast.success('Password changed');
  };
  const switchRole = async () => {
    const to = profile.role === 'client' ? 'freelancer' : 'client';
    if (!(await askConfirm(`Switch your account to ${to}? Your existing orders stay visible.`))) return;
    const { error } = await supabase.from('profiles').update({ role: to, profile_completed: to === 'client' }).eq('id', user.id);
    if (error) return toast.error(error);
    await refreshProfile(); toast.success(`You are now a ${to}`);
  };
  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <h3 className="font-heading font-semibold">Sign-in</h3>
        <p className="text-sm">Email: <b>{user.email}</b> {user.email_confirmed_at ? <span className="text-emerald-600">(verified)</span> : <span className="text-amber-600">(not verified)</span>}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1"><Input label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <Button onClick={changePw} loading={busy === 'pw'} disabled={!pw}>Change password</Button>
        </div>
      </Card>
      <Card className="space-y-4 p-6">
        <h3 className="font-heading font-semibold">Private contact details</h3>
        <p className="text-sm text-muted">Only you and HN admins can see these. Never share contact details in chat to avoid platform rules.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone" value={priv.phone} onChange={(e) => setPriv({ ...priv, phone: e.target.value })} maxLength={30} />
          <Input label="WhatsApp" value={priv.whatsapp} onChange={(e) => setPriv({ ...priv, whatsapp: e.target.value })} maxLength={30} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={priv.email_notifications} onChange={(e) => setPriv({ ...priv, email_notifications: e.target.checked })} />Email me about orders, payments and messages</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={priv.whatsapp_notifications} onChange={(e) => setPriv({ ...priv, whatsapp_notifications: e.target.checked })} />WhatsApp me about new orders, deliveries and payments</label>
        <Button onClick={savePrivate} loading={busy === 'priv'}>Save</Button>
      </Card>
      <Card className="space-y-4 p-6">
        <h3 className="font-heading font-semibold">Privacy & appearance</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={profile.show_online_status} onChange={(e) => setOnline(e.target.checked)} />Show when I'm online and my last-seen time</label>
        <div className="flex flex-wrap gap-2">
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn('rounded-xl border px-4 py-2 text-sm font-medium capitalize', mode === m ? 'border-brand bg-brand-50 text-brand dark:bg-brand/10' : 'border-slate-300 dark:border-navy-700')}>{m} mode</button>
          ))}
        </div>
      </Card>
      {profile.role !== 'admin' && (
        <Card className="p-6">
          <h3 className="font-heading font-semibold">Account type</h3>
          <p className="mt-1 text-sm text-muted">You are registered as a <b className="capitalize">{profile.role}</b>.</p>
          <Button variant="outline" className="mt-3" onClick={switchRole}>Switch to {profile.role === 'client' ? 'freelancer' : 'client'}</Button>
        </Card>
      )}
    </div>
  );
}

function BlockedTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<{ blocked_id: string; profile: { full_name: string; avatar_url: string | null } }[]>([]);
  const load = () => user && supabase.from('user_blocks').select('blocked_id, profile:profiles!user_blocks_blocked_id_fkey(full_name,avatar_url)').eq('blocker_id', user.id)
    .then(({ data }) => setRows((data as never) ?? []));
  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const unblock = async (id: string) => {
    const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', user!.id).eq('blocked_id', id);
    if (error) toast.error(error); else { toast.success('Unblocked'); load(); }
  };
  return (
    <Card className="p-6">
      {rows.length === 0 ? <p className="text-sm text-muted">You haven't blocked anyone.</p> : rows.map((r) => (
        <div key={r.blocked_id} className="flex items-center gap-3 py-2">
          <Avatar url={r.profile?.avatar_url} name={r.profile?.full_name} size={36} />
          <span className="flex-1 text-sm font-medium">{r.profile?.full_name}</span>
          <Button size="sm" variant="outline" onClick={() => unblock(r.blocked_id)}>Unblock</Button>
        </div>
      ))}
    </Card>
  );
}

type SettingsTab = 'profile' | 'account' | 'security' | 'verification' | 'referrals' | 'blocked';
export default function Settings() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs: { value: SettingsTab; label: string }[] = [
    { value: 'profile', label: 'Profile' }, { value: 'account', label: 'Account & privacy' }, { value: 'security', label: 'Security' },
    ...(profile?.role === 'freelancer' ? [{ value: 'verification' as const, label: 'Verification' }] : []),
    ...(profile?.role !== 'admin' ? [{ value: 'referrals' as const, label: 'Referrals & credits' }] : []),
    { value: 'blocked', label: 'Blocked users' },
  ];
  const t = params.get('tab') as SettingsTab | null;
  const tab: SettingsTab = t && tabs.some((x) => x.value === t) ? t : 'profile';
  const setTab = (v: SettingsTab) => setParams(v === 'profile' ? {} : { tab: v }, { replace: true });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Account settings" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      <div className="mt-5">
        {tab === 'profile' && <Card className="p-6"><ProfileForm /></Card>}
        {tab === 'account' && <AccountTab />}
        {tab === 'security' && <SecurityTab />}
        {tab === 'verification' && <VerificationTab />}
        {tab === 'referrals' && <ReferralTab />}
        {tab === 'blocked' && <BlockedTab />}
      </div>
    </div>
  );
}
