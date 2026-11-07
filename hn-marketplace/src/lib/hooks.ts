import { useCallback, useEffect, useState } from 'react';
import { supabase, errorMessage } from './supabase';
import type { Category } from './types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useNavigate } from 'react-router-dom';

/** Runs an async loader; exposes data/loading/error and a reload function. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fn()); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

/** Throwing wrapper for supabase queries: `const rows = await q(supabase.from(...)...)` */
export async function q<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(errorMessage(error));
  return data as T;
}

let categoryCache: Category[] | null = null;
export function useCategories() {
  const [cats, setCats] = useState<Category[]>(categoryCache ?? []);
  useEffect(() => {
    if (categoryCache) return;
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      categoryCache = (data as Category[]) ?? [];
      setCats(categoryCache);
    });
  }, []);
  return {
    all: cats,
    parents: cats.filter((c) => !c.parent_id),
    childrenOf: (id: string | null | undefined) => cats.filter((c) => c.parent_id === id),
    byId: (id: string | null | undefined) => cats.find((c) => c.id === id),
  };
}
export const clearCategoryCache = () => { categoryCache = null; };

export function useFavorites() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    supabase.from('favorite_gigs').select('gig_id').eq('user_id', user.id).then(({ data }) => setIds(new Set((data ?? []).map((r) => r.gig_id as string))));
  }, [user]);
  const toggle = async (gigId: string) => {
    if (!user) { nav('/login'); return; }
    const has = ids.has(gigId);
    setIds((s) => { const n = new Set(s); if (has) n.delete(gigId); else n.add(gigId); return n; });
    const { error } = has
      ? await supabase.from('favorite_gigs').delete().eq('user_id', user.id).eq('gig_id', gigId)
      : await supabase.from('favorite_gigs').insert({ user_id: user.id, gig_id: gigId });
    if (error) { toast.error(error); setIds((s) => { const n = new Set(s); if (has) n.add(gigId); else n.delete(gigId); return n; }); }
    else toast.success(has ? 'Removed from saved' : 'Saved to favorites');
  };
  return { ids, toggle };
}

export type PaymentChannel = 'bank' | 'jazzcash' | 'easypaisa' | 'raast';
export interface PaymentChannels {
  bank: { enabled: boolean; label?: string };
  jazzcash: { enabled: boolean; label?: string; account_title: string; number: string };
  easypaisa: { enabled: boolean; label?: string; account_title: string; number: string };
  raast: { enabled: boolean; label?: string; account_title: string; raast_id: string };
}
export const DEFAULT_CHANNELS: PaymentChannels = {
  bank: { enabled: true }, jazzcash: { enabled: false, account_title: '', number: '' },
  easypaisa: { enabled: false, account_title: '', number: '' }, raast: { enabled: false, account_title: '', raast_id: '' },
};
export interface PlatformSettings {
  payment_channels: PaymentChannels;
  commission_rate: number; client_service_fee_rate: number; clearance_days: number; min_withdrawal: number;
  auto_complete_days: number; gig_moderation: boolean; online_payments_enabled: boolean;
  bank_instructions: { account_title: string; bank_name: string; iban: string; account_number: string; notes: string };
  site_contact: { email: string; phone: string; whatsapp: string; address: string };
  client_fee_free_threshold: number;
  level_commission: { rising: number; top: number };
  seller_level_rules: { rising: { orders: number; rating: number }; top: { orders: number; rating: number; reviews: number } };
  founding_program: { enabled: boolean; commission_rate: number; months: number; slots: number };
  late_compensation_rate: number;
  referral_reward: { enabled: boolean; amount: number; min_order: number };
  payout_sla_days: number;
  company_info: { legal_name: string; registration: string; ntn: string; address: string };
  booking_url: string;
  support_hours: string;
  online_gateway: { provider: string; label: string; methods: string[] };
}
export const DEFAULT_SETTINGS: Omit<PlatformSettings, 'payment_channels' | 'bank_instructions' | 'site_contact'> = {
  commission_rate: 0.1, client_service_fee_rate: 0.03, clearance_days: 7, min_withdrawal: 1000, auto_complete_days: 3, gig_moderation: true,
  online_payments_enabled: false, client_fee_free_threshold: 5000, level_commission: { rising: 0.09, top: 0.08 },
  seller_level_rules: { rising: { orders: 5, rating: 4.5 }, top: { orders: 25, rating: 4.7, reviews: 10 } },
  founding_program: { enabled: true, commission_rate: 0, months: 3, slots: 50 }, late_compensation_rate: 0.1,
  referral_reward: { enabled: true, amount: 500, min_order: 2000 }, payout_sla_days: 3,
  company_info: { legal_name: '', registration: '', ntn: '', address: '' }, booking_url: '', support_hours: 'Mon–Sat, 10am–7pm (PKT)',
  online_gateway: { provider: '', label: 'Card, JazzCash or Easypaisa', methods: ['card', 'jazzcash', 'easypaisa'] },
};

let settingsCache: Promise<PlatformSettings> | null = null;
export async function loadSettings(fresh = false): Promise<PlatformSettings> {
  if (!settingsCache || fresh) {
    settingsCache = (async () => {
      const rows = await q(supabase.from('platform_settings').select('key,value'));
      const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
      for (const r of rows as { key: string; value: unknown }[]) out[r.key] = r.value;
      out.payment_channels = { ...DEFAULT_CHANNELS, ...(out.payment_channels as object | undefined) };
      for (const k of ['client_fee_free_threshold', 'commission_rate', 'client_service_fee_rate', 'late_compensation_rate', 'payout_sla_days'] as const) out[k] = Number(out[k]);
      return out as unknown as PlatformSettings;
    })();
    settingsCache.catch(() => { settingsCache = null; });
  }
  return settingsCache;
}
export function useSettings() {
  return useAsync(() => loadSettings(true), []);
}
/** Cached public settings for marketing pages (fees, contact details). */
export function usePublicSettings() {
  const [s, setS] = useState<PlatformSettings | null>(null);
  useEffect(() => { let on = true; loadSettings().then((x) => on && setS(x)).catch(() => null); return () => { on = false; }; }, []);
  return s;
}
