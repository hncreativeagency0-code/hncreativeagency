// Returns ICE servers (STUN + TURN) for WebRTC calls to signed-in users only.
// Secrets live in Supabase → Edge Functions → Secrets, never in the frontend.
//
// Option A (recommended): Cloudflare Realtime TURN
//   CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN
// Option B: any TURN server with static credentials (e.g. self-hosted coturn)
//   TURN_URLS (comma separated, e.g. "turn:turn.example.com:3478,turns:turn.example.com:5349"), TURN_USERNAME, TURN_CREDENTIAL
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Only authenticated users may obtain TURN credentials (prevents relay abuse)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const stun: RTCIceServerLike = { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] };

  const keyId = Deno.env.get('CLOUDFLARE_TURN_KEY_ID');
  const token = Deno.env.get('CLOUDFLARE_TURN_API_TOKEN');
  if (keyId && token) {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 4 * 3600 }),
    });
    if (r.ok) {
      const data = await r.json() as { iceServers: RTCIceServerLike[] };
      // Browsers commonly block port 53; drop those URLs
      const iceServers = data.iceServers.map((s) => ({ ...s, urls: ([] as string[]).concat(s.urls).filter((u) => !/:53(\?|$)/.test(u)) }));
      return json({ iceServers });
    }
    console.error('Cloudflare TURN error', r.status, await r.text());
  }

  const urls = Deno.env.get('TURN_URLS');
  if (urls && Deno.env.get('TURN_USERNAME') && Deno.env.get('TURN_CREDENTIAL')) {
    return json({ iceServers: [stun, { urls: urls.split(',').map((u) => u.trim()), username: Deno.env.get('TURN_USERNAME'), credential: Deno.env.get('TURN_CREDENTIAL') }] });
  }

  return json({ iceServers: [stun], warning: 'No TURN server configured; calls may fail on restrictive networks.' });
});

type RTCIceServerLike = { urls: string | string[]; username?: string; credential?: string };
