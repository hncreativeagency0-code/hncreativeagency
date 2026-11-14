// Emails a notification when a row is inserted into public.notifications.
// Wire it up in Supabase → Database → Webhooks: table `notifications`, event INSERT,
// type "Supabase Edge Function" → send-email, and add header  x-webhook-secret: <WEBHOOK_SECRET>.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM (e.g. "HN Creative Agency <notifications@yourdomain.com>"),
//          SITE_URL (e.g. https://hncreativeagency.pages.dev), WEBHOOK_SECRET
// Users can opt out in Settings (profile_private.email_notifications).
//
// WhatsApp alerts (optional): users who switch on "WhatsApp me about…" in Settings also get a WhatsApp
// message for important events, sent with the WhatsApp Cloud API (Meta Business). Set:
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TEMPLATE (an approved template with 2 body variables:
//   {{1}} = title, {{2}} = link), WHATSAPP_TEMPLATE_LANG (default en)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
// Chatty types are not emailed one by one
const SKIP = new Set(['message']);
// Only these are worth a WhatsApp ping
const WA_TYPES = new Set(['new_order', 'order_accepted', 'delivery', 'payment', 'order_completed', 'proposal', 'custom_offer', 'dispute', 'withdrawal', 'credit']);

/** Pakistani mobile number → 92XXXXXXXXXX (or null). */
const toMsisdn = (n: string | null) => {
  const d = (n ?? '').replace(/[^\d]/g, '');
  if (/^03\d{9}$/.test(d)) return `92${d.slice(1)}`;
  if (/^923\d{9}$/.test(d)) return d;
  return null;
};
async function sendWhatsApp(to: string, title: string, link: string) {
  const token = Deno.env.get('WHATSAPP_TOKEN'); const phoneId = Deno.env.get('WHATSAPP_PHONE_ID'); const template = Deno.env.get('WHATSAPP_TEMPLATE');
  if (!token || !phoneId || !template) return false;
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'en' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: title.slice(0, 200) }, { type: 'text', text: link }] }] } }),
  });
  if (!r.ok) console.error('WhatsApp error', r.status, await r.text());
  return r.ok;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) return new Response('Unauthorized', { status: 401 });
  const key = Deno.env.get('RESEND_API_KEY');

  const { record } = await req.json() as { record: { id: string; user_id: string; type: string; title: string; body: string | null; link: string | null } };
  if (!record || SKIP.has(record.type)) return new Response('skipped');

  const { data: pref } = await admin.from('profile_private').select('email_notifications,whatsapp_notifications,whatsapp').eq('id', record.user_id).maybeSingle();
  const site0 = Deno.env.get('SITE_URL') ?? '';
  if (pref?.whatsapp_notifications && WA_TYPES.has(record.type)) {
    const to = toMsisdn(pref.whatsapp);
    if (to) await sendWhatsApp(to, record.title, record.link ? `${site0}${record.link}` : site0).catch((e) => console.error(e));
  }
  if (!key) return new Response('Email not configured', { status: 200 });
  if (pref && !pref.email_notifications) return new Response('opted out');

  const { data: u } = await admin.auth.admin.getUserById(record.user_id);
  const to = u?.user?.email;
  if (!to) return new Response('no email');

  const site = Deno.env.get('SITE_URL') ?? '';
  const link = record.link ? `${site}${record.link}` : site;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0F172A">
      <p style="font-weight:600;color:#6C63FF;margin:0 0 16px">HN Creative Agency</p>
      <h2 style="margin:0 0 8px;font-size:18px">${esc(record.title)}</h2>
      ${record.body ? `<p style="color:#64748B;margin:0 0 20px">${esc(record.body)}</p>` : ''}
      <a href="${esc(link)}" style="display:inline-block;background:#6C63FF;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Open</a>
      <p style="color:#94A3B8;font-size:12px;margin-top:28px">You can turn off email notifications in Account settings.</p>
    </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM'), to, subject: record.title, html }),
  });
  if (r.ok) await admin.from('notifications').update({ emailed: true }).eq('id', record.id);
  else console.error('Resend error', r.status, await r.text());
  return new Response(r.ok ? 'sent' : 'failed', { status: 200 });
});
