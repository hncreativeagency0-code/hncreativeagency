import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isConfigured } from '@/lib/supabase';
import type { Profile, Notification } from '@/lib/types';

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  notifications: Notification[];
  unread: number;
  markRead: (id?: string) => Promise<void>;
  onlineUsers: Set<string>;
  /** Signed in with password only, but the account has two-step login switched on. */
  needsMfa: boolean;
  refreshMfa: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [needsMfa, setNeedsMfa] = useState(false);
  const uidRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // defer to avoid running queries inside the auth callback
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Two-step login: an aal1 session on an account with a verified authenticator must enter its code
  const refreshMfa = useCallback(async () => {
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setNeedsMfa(!!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
    } catch { setNeedsMfa(false); }
  }, []);
  useEffect(() => { if (!session) setNeedsMfa(false); else refreshMfa(); }, [session?.access_token, refreshMfa]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notifications (realtime), last-seen heartbeat, presence
  useEffect(() => {
    const uid = session?.user.id;
    uidRef.current = uid ?? null;
    if (!uid) { setNotifications([]); setOnlineUsers(new Set()); return; }

    supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setNotifications((data as Notification[]) ?? []));

    const notifChannel = supabase
      .channel(`notifications:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (p) => setNotifications((n) => [p.new as Notification, ...n].slice(0, 100)))
      .subscribe();

    const beat = () => supabase.from('profile_private').update({ last_seen_at: new Date().toISOString() }).eq('id', uid).then(() => {});
    beat();
    const t = setInterval(beat, 60_000);

    return () => { supabase.removeChannel(notifChannel); clearInterval(t); };
  }, [session?.user.id]);

  // Presence: only broadcast yourself if your privacy setting allows it
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid || !profile) return;
    const ch = supabase.channel('online-users', { config: { private: true, presence: { key: uid } } });
    ch.on('presence', { event: 'sync' }, () => setOnlineUsers(new Set(Object.keys(ch.presenceState()))))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && profile.show_online_status) await ch.track({ at: Date.now() });
      });
    return () => { supabase.removeChannel(ch); };
  }, [session?.user.id, profile?.show_online_status]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = async (id?: string) => {
    const uid = uidRef.current;
    if (!uid) return;
    let q = supabase.from('notifications').update({ is_read: true }).eq('user_id', uid);
    q = id ? q.eq('id', id) : q.eq('is_read', false);
    await q;
    setNotifications((n) => n.map((x) => (!id || x.id === id ? { ...x, is_read: true } : x)));
  };

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    refreshProfile: () => loadProfile(session?.user.id),
    signOut: async () => { await supabase.auth.signOut(); setProfile(null); },
    notifications,
    unread: notifications.filter((n) => !n.is_read).length,
    markRead,
    onlineUsers,
    needsMfa,
    refreshMfa,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
