import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, User, Briefcase, Shield, LogOut, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DEMO_USERS } from './data';
import { cn } from '@/lib/utils';

/** Bottom bar in the live preview: explains the sample data and switches between roles. */
export function DemoBar() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const as = async (role: keyof typeof DEMO_USERS | null) => {
    setBusy(true);
    await supabase.auth.signOut();
    if (role) await supabase.auth.signInWithPassword({ email: DEMO_USERS[role].email, password: 'demo' });
    setBusy(false);
    nav(role === 'admin' ? '/admin' : role ? '/app' : '/');
  };
  // Shareable preview links: #/app/orders?as=client signs in as that role and opens the page
  useEffect(() => {
    const h = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '';
    const role = new URLSearchParams(h.split('?')[1] ?? '').get('as') as keyof typeof DEMO_USERS | null;
    if (!role || !DEMO_USERS[role]) return;
    (async () => {
      setBusy(true);
      await supabase.auth.signInWithPassword({ email: DEMO_USERS[role].email, password: 'demo' });
      setBusy(false);
      const rest = new URLSearchParams(h.split('?')[1] ?? ''); rest.delete('as');
      nav(`${h.split('?')[0] || '/app'}${rest.toString() ? `?${rest}` : ''}`, { replace: true });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const current = Object.entries(DEMO_USERS).find(([, u]) => u.id === user?.id)?.[0] ?? null;
  if (hidden) return <button onClick={() => setHidden(false)} className="fixed bottom-3 left-3 z-[95] rounded-full bg-navy px-3 py-2 text-xs font-medium text-white shadow-lg dark:bg-brand" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>Preview options</button>;
  const btn = (role: keyof typeof DEMO_USERS | null, label: string, Icon: typeof User) => (
    <button disabled={busy} onClick={() => as(role)}
      className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-60', current === role ? 'bg-brand text-white' : 'bg-white/10 text-white hover:bg-white/20')}>
      <Icon className="h-3.5 w-3.5" />{label}
    </button>
  );
  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] border-t border-white/10 bg-navy/95 text-white backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 py-2">
        <span className="mr-1 flex items-center gap-1.5 text-xs text-slate-300"><Eye className="h-3.5 w-3.5 text-brand-300" /><b className="text-white">Live preview</b> · sample data, resets on reload · view as</span>
        {btn(null, 'Visitor', LogOut)}
        {btn('client', 'Client', User)}
        {btn('freelancer', 'Freelancer', Briefcase)}
        {btn('admin', 'Admin', Shield)}
        <button onClick={() => setHidden(true)} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:text-white" aria-label="Hide preview bar"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
