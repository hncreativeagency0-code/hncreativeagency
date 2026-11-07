import { createClient } from '@supabase/supabase-js';
import { demoFetch, fakeChannel, DEMO_BASE } from '@/demo/server';

/** Live-preview build (VITE_DEMO=true): talks to an in-browser sample backend instead of Supabase. */
export const DEMO = import.meta.env.VITE_DEMO === 'true';

const url = DEMO ? DEMO_BASE : (import.meta.env.VITE_SUPABASE_URL as string | undefined);
const anonKey = DEMO ? 'demo-anon-key' : (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

/** False until the two public Supabase env vars are set. */
export const isConfigured = Boolean(url && anonKey);

const memory = new Map<string, string>();
const memoryStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) };

// The anon key is designed to be public: all access control lives in Postgres RLS + functions.
// Never put the service_role key in any VITE_ variable.
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: DEMO ? { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage: memoryStorage }
    : { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 20 } },
  ...(DEMO ? { global: { fetch: demoFetch } } : {}),
});
if (DEMO) {
  // No websocket server in the preview: realtime channels become no-ops.
  (supabase as unknown as { channel: unknown }).channel = fakeChannel;
  (supabase as unknown as { removeChannel: unknown }).removeChannel = async () => 'ok';
}

const GENERIC = 'Something went wrong on our side. Please try again — if it keeps happening, contact support.';

/** Turns Postgres/Supabase/network errors into a friendly sentence — never technical jargon. */
export function errorMessage(e: unknown): string {
  if (!e) return GENERIC;
  if (typeof e === 'string') return e;
  const err = e as { message?: string; details?: string; error_description?: string; code?: string; status?: number };
  const msg = (err.message || err.error_description || '').trim();
  // Messages raised by our own database functions are already written for people
  if (err.code === 'P0001' && msg) return msg;
  if (/suspended|Administrator access required|Not signed in/i.test(msg)) return msg.replace('Not signed in', 'Please sign in to continue.');
  const map: [RegExp, string][] = [
    [/JWT|jwt expired|refresh token|session.*(missing|expired)/i, 'Your session expired. Please sign in again.'],
    [/Failed to fetch|NetworkError|Load failed|network request failed|fetch failed/i, 'No internet connection — check your connection and try again.'],
    [/timeout|timed out|504|502/i, 'The server is taking too long to respond. Please try again in a moment.'],
    [/rate limit|too many requests|429/i, 'You are doing that too often. Please wait a minute and try again.'],
    [/Invalid login credentials/i, 'Incorrect email or password.'],
    [/Email not confirmed/i, 'Please verify your email first — check your inbox for the link.'],
    [/User already registered|already been registered/i, 'An account with this email already exists. Try signing in.'],
    [/Password should be|weak password/i, 'Choose a stronger password: at least 8 characters with letters and numbers.'],
    [/duplicate key|already exists|unique/i, 'This already exists.'],
    [/violates check constraint|value too long|out of range|invalid input/i, 'Some values are not allowed. Please check the form and try again.'],
    [/row-level security|permission denied|not authori[sz]ed|forbidden|42501/i, 'You don’t have permission to do that.'],
    [/violates foreign key|not-null constraint|null value in column/i, 'Some required information is missing. Please check the form.'],
    [/exceeded the maximum allowed size|payload too large|413/i, 'That file is too large. Please upload a smaller file.'],
    [/mime type|invalid file type|not supported/i, 'That file type isn’t supported. Please upload an image or PDF.'],
    [/JSON object requested|PGRST116|0 rows/i, 'We couldn’t find that. It may have been removed.'],
  ];
  for (const [re, text] of map) if (re.test(msg) || (err.code && re.test(err.code))) return text;
  // Anything that still looks technical gets a generic message
  if (!msg || /\b(function|relation|column|schema|syntax|PGRST|SQLSTATE|pg_|uuid|null|undefined|TypeError|stack)\b/i.test(msg) || msg.length > 180) return GENERIC;
  return msg;
}

/** Calls an RPC and throws a friendly Error on failure. */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(errorMessage(error));
  return data as T;
}
