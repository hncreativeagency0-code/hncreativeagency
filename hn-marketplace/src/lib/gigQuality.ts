/* Gig quality checklist — shown to freelancers while editing and to admins while reviewing. */
export interface GigDraftLike {
  title: string; description: string; tags: string[]; cover_url: string | null; gallery: string[];
  faqs: { q: string; a: string }[]; requirements?: string | null; category_id?: string | null; portfolio_ids?: string[];
}
export interface PkgLike { price: number; delivery_days: number; features?: string[]; enabled?: boolean }
export interface Check { id: string; label: string; ok: boolean; required: boolean; tip: string }

export function gigChecklist(g: GigDraftLike, pkgs: PkgLike[]): Check[] {
  const on = pkgs.filter((p) => p.enabled !== false);
  const t = g.title.trim();
  return [
    { id: 'cover', label: 'Cover image', ok: !!g.cover_url, required: true, tip: 'Add a clear 1280×800 cover — gigs with real work samples get far more clicks.' },
    { id: 'title', label: 'Clear title', ok: t.length >= 25 && t.length <= 90 && /^i will /i.test(t), required: true, tip: 'Start with “I will…”, say the result and who it is for (25–90 characters).' },
    { id: 'category', label: 'Category chosen', ok: !!g.category_id, required: true, tip: 'Pick the category clients will browse.' },
    { id: 'desc', label: 'Detailed description', ok: g.description.trim().length >= 300, required: false, tip: 'Aim for 300+ characters: what’s included, your process, and why you.' },
    { id: 'price', label: 'Fair starting price', ok: on.length > 0 && on.every((p) => p.price >= 500), required: true, tip: 'Every package must be at least PKR 500.' },
    { id: 'packages', label: 'Basic, Standard & Premium', ok: on.length >= 3, required: false, tip: 'Three packages let clients choose — most buy the middle one.' },
    { id: 'features', label: 'Package features listed', ok: on.length > 0 && on.every((p) => (p.features?.length ?? 0) >= 2), required: false, tip: 'List at least 2 features in each package (e.g. “Source files”).' },
    { id: 'tags', label: 'At least 3 search tags', ok: g.tags.length >= 3, required: false, tip: 'Add words clients search for, e.g. “logo”, “branding”.' },
    { id: 'gallery', label: 'Portfolio / gallery samples', ok: g.gallery.length > 0 || (g.portfolio_ids?.length ?? 0) > 0, required: false, tip: 'Show real past work. Never use other people’s or famous brands’ work.' },
    { id: 'faq', label: 'FAQ answered', ok: g.faqs.filter((f) => f.q.trim() && f.a.trim()).length >= 2, required: false, tip: 'Answer 2+ common questions (source files, revisions, timeline).' },
    { id: 'req', label: 'Requirements for the client', ok: (g.requirements ?? '').trim().length >= 20, required: false, tip: 'Tell the client what you need to start.' },
  ];
}

export const qualityScore = (c: Check[]) => Math.round((c.filter((x) => x.ok).length / c.length) * 100);

/* Smart writing helper — builds a strong title and description outline from the freelancer's inputs.
   Works offline (no AI service needed); the freelancer always edits the result. */
export function suggestTitles(service: string, audience: string, benefit: string): string[] {
  const s = service.trim().toLowerCase() || 'logo';
  const a = audience.trim() || 'your business';
  const b = benefit.trim() || 'stands out';
  return [
    `I will create a professional ${s} for ${a}`,
    `I will create a modern ${s} that ${b}`,
    `I will deliver a high-quality ${s} for ${a} in 24–48 hours`,
    `I will make a custom ${s} with unlimited ideas and source files`,
  ].map((x) => x.replace(/\s+/g, ' ').slice(0, 90));
}

export function suggestDescription(o: { service: string; audience: string; years?: number | null; skills?: string[]; includes: string[] }): string {
  const s = o.service.trim() || 'design';
  const yrs = o.years ? `${o.years}+ years` : 'years';
  const inc = o.includes.filter(Boolean);
  return [
    `Looking for a ${s} that actually works for ${o.audience.trim() || 'your business'}? I have ${yrs} of experience helping Pakistani businesses look professional and win more customers.`,
    '',
    'WHAT YOU GET',
    ...(inc.length ? inc : ['Original work made for you — no templates', 'Revisions included in every package', 'Files ready for print and social media']).map((x) => `• ${x}`),
    '',
    'MY PROCESS',
    '1. You share your brief and examples you like',
    '2. I send first drafts within the delivery time',
    '3. We refine together with revisions',
    '4. You receive final files and full ownership',
    '',
    o.skills?.length ? `TOOLS: ${o.skills.slice(0, 6).join(', ')}` : '',
    '',
    'Message me before ordering if you have questions — I usually reply within an hour. Your payment is protected by HN until you approve the work.',
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trim();
}
