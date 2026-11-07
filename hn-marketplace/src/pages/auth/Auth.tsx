import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, User, MailCheck, Eye, EyeOff, KeyRound, Gift } from 'lucide-react';
import { supabase, errorMessage } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Card, Input, LegacyImg, Monogram } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useSeo } from '@/lib/seo';
import { usePublicSettings } from '@/lib/hooks';
import { track } from '@/lib/analytics';

const origin = () => window.location.origin;

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  useSeo({ title, noindex: true });
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4 py-12 dark:from-navy-950 dark:to-navy-900">
      <Card className="w-full max-w-md p-7 sm:p-8">
        <div className="mb-6 text-center">
          <LegacyImg src="/assets/images/favicon.png" alt="" className="mx-auto h-12 w-12 rounded-xl object-contain" fallback={<Monogram className="mx-auto h-12 w-12" />} />
          <h1 className="mt-4 font-heading text-2xl font-semibold text-navy dark:text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
      </Card>
    </div>
  );
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-[34px] text-muted" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const strongEnough = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

export function Login() {
  const [params] = useSearchParams();
  const { user, loading, needsMfa, refreshMfa } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [mfa, setMfa] = useState<{ factorId: string } | null>(null);
  const [code, setCode] = useState('');
  const next = params.get('next') || '/app';
  useEffect(() => {
    if (user && needsMfa && !mfa) supabase.auth.mfa.listFactors().then(({ data }) => { const f = data?.totp?.[0]; if (f) setMfa({ factorId: f.id }); });
  }, [user, needsMfa]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!loading && user && !mfa && !busy && !needsMfa) return <Navigate to={next} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setUnconfirmed(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      if (/confirm/i.test(error.message)) setUnconfirmed(true);
      return toast.error(/invalid login/i.test(error.message) ? 'Incorrect email or password' : errorMessage(error));
    }
    // Two-step login: ask for the authenticator code when the account has one set up
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      const { data: f } = await supabase.auth.mfa.listFactors();
      const factor = f?.totp?.[0];
      setBusy(false);
      if (factor) { setMfa({ factorId: factor.id }); return; }
    }
    setBusy(false);
    nav(next, { replace: true });
  };
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfa || !/^\d{6}$/.test(code)) return toast.error('Enter the 6-digit code from your authenticator app');
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfa.factorId, code });
    setBusy(false);
    if (error) return toast.error('That code didn’t work. Try the newest code in your app.');
    await refreshMfa();
    setMfa(null); nav(next, { replace: true });
  };
  if (mfa) return (
    <Shell title="Enter your security code" subtitle="Open your authenticator app and enter the 6-digit code for HN Creative Agency.">
      <form onSubmit={verifyCode} className="space-y-4">
        <div className="flex justify-center"><KeyRound className="h-10 w-10 text-brand" /></div>
        <Input id="login-code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus className="text-center text-lg tracking-[0.4em]" />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Verify and sign in</Button>
        <button type="button" onClick={async () => { await supabase.auth.signOut(); setMfa(null); setCode(''); }} className="w-full text-center text-sm text-muted">Use a different account</button>
      </form>
    </Shell>
  );
  const resend = async () => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${origin()}/app` } });
    if (error) toast.error(error); else toast.success('Verification email sent again');
  };
  return (
    <Shell title="Welcome back" subtitle="Sign in to your HN Creative account">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="text-right"><Link to="/forgot-password" className="text-sm font-medium text-brand">Forgot password?</Link></div>
        {unconfirmed && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Please verify your email first. <button type="button" onClick={resend} className="font-medium underline">Resend link</button>
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">New here? <Link to="/register" className="font-medium text-brand">Create an account</Link></p>
    </Shell>
  );
}

export function Register() {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const toast = useToast();
  const [role, setRole] = useState<'client' | 'freelancer'>(params.get('role') === 'freelancer' ? 'freelancer' : 'client');
  const [f, setF] = useState({ name: '', email: '', password: '', agree: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const ref = (params.get('ref') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  const settings = usePublicSettings();
  const fp = settings?.founding_program;
  if (!loading && user) return <Navigate to="/app" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = 'Enter your full name';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) er.email = 'Enter a valid email';
    if (!strongEnough(f.password)) er.password = 'At least 8 characters with letters and numbers';
    if (!f.agree) er.agree = 'Please accept the terms';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { full_name: f.name.trim(), role, ...(ref ? { ref } : {}) }, emailRedirectTo: `${origin()}/app/onboarding` },
    });
    setBusy(false);
    if (!error) track('sign_up', { method: 'email', role });
    if (error) return toast.error(/registered|exists/i.test(error.message) ? 'An account with this email already exists. Try signing in.' : errorMessage(error));
    if (data.session) return; // email confirmation disabled in Supabase → already signed in, guard redirects
    setSent(true);
  };

  if (sent) return (
    <Shell title="Check your inbox">
      <div className="text-center">
        <MailCheck className="mx-auto h-12 w-12 text-brand" />
        <p className="mt-4 text-sm text-muted">We sent a verification link to <b className="text-navy dark:text-white">{f.email}</b>. Click it to activate your account, then complete your profile.</p>
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-brand">Back to sign in</Link>
      </div>
    </Shell>
  );

  return (
    <Shell title="Create your account" subtitle="Join HN Creative Agency — Design. Market. Grow.">
      {ref && <p className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><Gift className="h-4 w-4 shrink-0" />You were invited by a friend — you’ll both get a credit after your first order.</p>}
      {role === 'freelancer' && fp?.enabled && <p className="mb-4 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand/10 dark:text-brand-200">Founding Freelancer offer: join now and pay {Math.round(fp.commission_rate * 100)}% commission for your first {fp.months} months (limited places).</p>}
      <div className="mb-5 grid grid-cols-2 gap-3">
        {([['client', User, 'I want to hire'], ['freelancer', Briefcase, 'I want to work']] as const).map(([r, I, l]) => (
          <button key={r} type="button" onClick={() => setRole(r)}
            className={cn('rounded-xl border-2 p-4 text-left transition', role === r ? 'border-brand bg-brand-50 dark:bg-brand/10' : 'border-slate-200 hover:border-slate-300 dark:border-navy-700')}>
            <I className={cn('h-5 w-5', role === r ? 'text-brand' : 'text-muted')} />
            <p className="mt-2 text-sm font-semibold capitalize">{r}</p><p className="text-xs text-muted">{l}</p>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Full name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} required />
        <Input label="Email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} required />
        <PasswordInput label="Password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={errors.password} hint="At least 8 characters with letters and numbers" required />
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />
          <span>I agree to the <Link to="/terms" className="text-brand">Terms</Link> and <Link to="/privacy" className="text-brand">Privacy Policy</Link></span>
        </label>
        {errors.agree && <p className="-mt-2 text-xs text-red-500">{errors.agree}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create {role} account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link to="/login" className="font-medium text-brand">Sign in</Link></p>
    </Shell>
  );
}

export function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin()}/reset-password` });
    setBusy(false);
    if (error) return toast.error(error);
    setSent(true);
  };
  return (
    <Shell title="Reset your password" subtitle={sent ? undefined : 'We’ll email you a secure reset link'}>
      {sent ? <p className="text-center text-sm text-muted">If an account exists for <b>{email}</b>, a reset link is on its way.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-medium text-brand">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPassword() {
  const toast = useToast();
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true); });
    supabase.auth.getSession().then(({ data: s }) => s.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strongEnough(pw)) return toast.error('At least 8 characters with letters and numbers');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error);
    toast.success('Password updated');
    nav('/app', { replace: true });
  };
  return (
    <Shell title="Choose a new password">
      {!ready ? <p className="text-center text-sm text-muted">Open this page from the link in your reset email. Links expire after one hour.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <PasswordInput label="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
        </form>
      )}
    </Shell>
  );
}
