/* Sample data for the live preview only (VITE_DEMO=true). Never shipped in the production build path. */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const H = 3600_000, D = 24 * H;
const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const inFuture = (ms: number) => new Date(Date.now() + ms).toISOString();

/** Generated cover artwork (data URIs — the preview can't load remote images). */
export function cover(seed: number, label: string, motif: 'rings' | 'bars' | 'grid' | 'wave' = 'rings') {
  const pal = [['#6C63FF', '#C9C5FF'], ['#0F172A', '#6C63FF'], ['#4A40D6', '#F1F0FF'], ['#1E293B', '#8A82FF'], ['#5A50F0', '#E4E2FF'], ['#334155', '#A9A3FF']][seed % 6];
  const shape = motif === 'rings' ? `<circle cx="600" cy="180" r="120" fill="none" stroke="#ffffff55" stroke-width="18"/><circle cx="600" cy="180" r="60" fill="#ffffff33"/>`
    : motif === 'bars' ? [0, 1, 2, 3, 4].map((i) => `<rect x="${470 + i * 54}" y="${300 - (i + 2) * 34}" width="36" height="${(i + 2) * 34}" rx="8" fill="#ffffff${['33', '44', '55', '66', '88'][i]}"/>`).join('')
    : motif === 'grid' ? [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => `<rect x="${480 + c * 70}" y="${70 + r * 70}" width="56" height="56" rx="12" fill="#ffffff${(r + c) % 2 ? '33' : '66'}"/>`)).join('')
    : `<path d="M0 360 C 160 300, 320 420, 480 350 S 720 300, 800 340 L800 500 L0 500 Z" fill="#ffffff2a"/><path d="M0 410 C 200 360, 360 460, 560 400 S 760 380, 800 400 L800 500 L0 500 Z" fill="#ffffff40"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[1]}"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/>${shape}<text x="56" y="420" font-family="Poppins,Arial,sans-serif" font-size="44" font-weight="700" fill="#ffffff">${label}</text><text x="58" y="456" font-family="Inter,Arial,sans-serif" font-size="18" fill="#ffffffcc">Sample preview image</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const DEMO_USERS = {
  client: { id: 'u-client', email: 'client@demo.hn', name: 'Sana Tariq' },
  freelancer: { id: 'u-f1', email: 'freelancer@demo.hn', name: 'Ayesha Malik' },
  admin: { id: 'u-admin', email: 'admin@demo.hn', name: 'HN Admin' },
} as const;

const prof = (p: Row): Row => ({
  username: null, avatar_url: null, title: null, bio: null, skills: [], years_experience: null, education: [], certifications: [], languages: [],
  hourly_rate: null, country: 'Pakistan', city: 'Lahore', availability: 'available', is_verified: false, status: 'active', profile_completed: true,
  show_online_status: true, rating_avg: 0, rating_count: 0, completed_orders: 0, seller_level: 'new', founding_until: null, created_at: at(120 * D), updated_at: at(D), ...p,
});

export function seed(): Record<string, Row[]> {
  const profiles = [
    prof({ id: 'u-client', role: 'client', full_name: 'Sana Tariq', city: 'Lahore' }),
    prof({ id: 'u-c2', role: 'client', full_name: 'Usman Ali', city: 'Karachi' }),
    prof({ id: 'u-admin', role: 'admin', full_name: 'HN Admin' }),
    prof({ id: 'u-f1', role: 'freelancer', full_name: 'Ayesha Malik', title: 'Brand Identity Designer', is_verified: true, rating_avg: 4.9, rating_count: 3, completed_orders: 2, founding_until: inFuture(60 * D),
      bio: 'I design logos and brand systems for startups and small businesses across Pakistan and the Gulf. Six years of experience with food, fashion and tech brands. Every project starts with a short discovery call.',
      skills: ['Logo design', 'Brand guidelines', 'Adobe Illustrator', 'Figma', 'Packaging'], years_experience: 6, languages: ['English', 'Urdu'], hourly_rate: 3500,
      education: [{ degree: 'BFA Communication Design', school: 'National College of Arts', year: '2019' }], certifications: [{ name: 'Brand Strategy', issuer: 'Google Skillshop', year: '2023' }] }),
    prof({ id: 'u-f2', role: 'freelancer', full_name: 'Bilal Ahmed', title: 'Video Editor & Motion Designer', city: 'Islamabad', rating_avg: 4.7, rating_count: 2, completed_orders: 1, founding_until: inFuture(75 * D),
      bio: 'Short-form video editor for brands and creators. Reels, TikToks and YouTube Shorts with captions, sound design and motion graphics.', skills: ['Premiere Pro', 'After Effects', 'Reels', 'Captions'], years_experience: 4, languages: ['English', 'Urdu', 'Punjabi'], hourly_rate: 2500 }),
    prof({ id: 'u-f3', role: 'freelancer', full_name: 'Hamza Qureshi', title: 'Shopify & Web Developer', city: 'Faisalabad', availability: 'busy', rating_avg: 5, rating_count: 1, completed_orders: 6, seller_level: 'rising',
      bio: 'I build fast Shopify stores and landing pages that convert. Theme customisation, speed optimisation and payment setup for Pakistani stores.', skills: ['Shopify', 'Liquid', 'React', 'Speed optimisation'], years_experience: 5, languages: ['English', 'Urdu'], hourly_rate: 4000 }),
    prof({ id: 'u-f4', role: 'freelancer', full_name: 'Mehwish Khan', title: 'Meta Ads Specialist', city: 'Lahore',
      bio: 'Performance marketer running Meta and Google campaigns for e-commerce and health brands. Clear weekly reporting.', skills: ['Meta Ads', 'Google Ads', 'Pixel setup', 'Copywriting'], years_experience: 3, languages: ['English', 'Urdu'], hourly_rate: 3000 }),
  ];
  const parents = [
    ['Graphic Design', 'graphic-design', 'PenTool'], ['Logo & Brand Identity', 'logo-brand-identity', 'Gem'], ['Video Editing', 'video-editing', 'Clapperboard'],
    ['AI Video Creation', 'ai-video-creation', 'Film'], ['Social Media Management', 'social-media-management', 'Share2'], ['Digital Marketing', 'digital-marketing', 'Megaphone'],
    ['Website Design & Development', 'website-design-development', 'MonitorSmartphone'], ['Product Advertisement Design', 'product-advertisement-design', 'ShoppingBag'],
    ['Motion Graphics', 'motion-graphics', 'Sparkles'], ['AI Image Generation', 'ai-image-generation', 'Image'],
  ];
  const categories: Row[] = parents.map(([name, slug, icon], i) => ({ id: `cat-${slug}`, parent_id: null, name, slug, icon, sort_order: i + 1, is_active: true, description: null, created_at: at(200 * D) }));
  [['logo-brand-identity', 'Logo Design', 'logo-design'], ['video-editing', 'Reels & Shorts', 'reels-shorts'], ['digital-marketing', 'Meta Ads', 'meta-ads'],
    ['website-design-development', 'Shopify Stores', 'shopify-stores'], ['website-design-development', 'Landing Pages', 'landing-pages'], ['graphic-design', 'Social Media Design', 'social-media-design']]
    .forEach(([p, name, slug], i) => categories.push({ id: `cat-${slug}`, parent_id: `cat-${p}`, name, slug, icon: null, sort_order: i, is_active: true, description: null, created_at: at(200 * D) }));

  const gig = (id: string, f: string, cat: string, sub: string | null, title: string, label: string, motif: 'rings' | 'bars' | 'grid' | 'wave', seedN: number, tags: string[], desc: string, pk: [string, number, number, number, string[]][], extra: Row = {}): [Row, Row[]] => {
    const tiers = ['basic', 'standard', 'premium'];
    const packages = pk.map(([name, price, days, rev, features], i) => ({ id: `${id}-p${i}`, gig_id: id, tier: tiers[i], name, description: features.slice(0, 2).join(', '), price, delivery_days: days, revisions: rev, features }));
    return [{
      id, freelancer_id: f, category_id: `cat-${cat}`, subcategory_id: sub ? `cat-${sub}` : null, title, description: desc, tags, cover_url: cover(seedN, label, motif),
      gallery: [cover(seedN + 1, label, motif === 'rings' ? 'grid' : 'rings')], portfolio_ids: [], requirements: 'Your brand or business name, a short description of your audience, and two or three examples you like.',
      faqs: [{ q: 'Do I get the source files?', a: 'Yes — Standard and Premium include editable source files.' }, { q: 'Can we talk before ordering?', a: 'Of course. Message me or start a call from the chat.' }],
      extras: [{ name: 'Express delivery', price: Math.round(pk[0][1] * 0.4), days: 1 }], status: 'published', rejection_reason: null,
      starting_price: Math.min(...pk.map((p) => p[1])), min_delivery_days: Math.min(...pk.map((p) => p[2])), rating_avg: 0, rating_count: 0, orders_completed: 0, seller_rank: f === 'u-f3' ? 1 : 0,
      published_at: at(seedN * 3 * D), created_at: at((seedN * 3 + 1) * D), updated_at: at(D), ...extra,
    }, packages];
  };
  const G = [
    gig('g-logo', 'u-f1', 'logo-brand-identity', 'logo-design', 'I will design a modern minimalist logo for your brand', 'Logo Design', 'rings', 0, ['logo', 'branding', 'minimal'],
      'A clean, memorable logo built around your brand story.\n\nYou get original concepts (no templates), a black, white and colour version, and files ready for print and social media. I start every project with a short questionnaire so the result fits your audience, not just my taste.',
      [['Starter', 6000, 3, 2, ['1 concept', 'PNG + JPG', 'Transparent background']], ['Brand Mark', 14000, 5, 4, ['3 concepts', 'Source files (AI, SVG)', 'Social media kit']], ['Full Identity', 32000, 10, 8, ['5 concepts', 'Brand guidelines PDF', 'Stationery design', 'Source files']]],
      { rating_avg: 4.9, rating_count: 3, orders_completed: 2 }),
    gig('g-brand', 'u-f1', 'logo-brand-identity', null, 'I will create a complete brand identity and style guide', 'Brand System', 'grid', 1, ['brand identity', 'style guide'],
      'For businesses that need more than a logo: colour palette, typography, logo variations, patterns and a style guide your team can follow. Ideal before launching a website or packaging.',
      [['Essentials', 25000, 7, 2, ['Logo + palette', 'Typography']], ['Complete', 48000, 14, 4, ['Style guide PDF', 'Social templates', 'Stationery']]]),
    gig('g-reels', 'u-f2', 'video-editing', 'reels-shorts', 'I will edit scroll-stopping reels, TikToks and shorts', 'Reels Edit', 'wave', 2, ['reels', 'tiktok', 'shorts', 'captions'],
      'Fast-paced vertical edits with hooks in the first second, animated captions, trending sound design and colour grading. Send raw footage; I return ready-to-post videos.',
      [['1 Reel', 3500, 2, 2, ['Up to 30 sec', 'Captions']], ['5 Reels', 15000, 5, 3, ['Up to 45 sec each', 'Captions + music']], ['Monthly 12', 32000, 14, 4, ['12 videos', 'Thumbnail covers', 'Priority delivery']]],
      { rating_avg: 4.7, rating_count: 2, orders_completed: 1 }),
    gig('g-motion', 'u-f2', 'motion-graphics', null, 'I will animate your logo with sound for intros and ads', 'Logo Motion', 'rings', 3, ['logo animation', 'intro'],
      'Smooth 5–10 second logo animation with sound design, delivered in vertical and horizontal formats for reels, YouTube and ads.',
      [['Simple', 5000, 3, 1, ['5 sec animation', 'MP4']], ['Pro', 11000, 5, 3, ['10 sec', 'Sound design', '4K + vertical']]]),
    gig('g-shopify', 'u-f3', 'website-design-development', 'shopify-stores', 'I will build a fast Shopify store that converts', 'Shopify Store', 'bars', 4, ['shopify', 'ecommerce', 'store'],
      'A complete Shopify store set up for Pakistani customers: theme customisation, product upload, COD and payment setup, WhatsApp button and speed optimisation.',
      [['Starter Store', 35000, 7, 2, ['Theme setup', '10 products']], ['Business', 75000, 12, 4, ['Custom sections', '50 products', 'Speed optimisation']], ['Premium', 140000, 21, 6, ['Custom design', 'Unlimited products', '1 month support']]],
      { rating_avg: 5, rating_count: 1, orders_completed: 1 }),
    gig('g-landing', 'u-f3', 'website-design-development', 'landing-pages', 'I will design and develop a high-converting landing page', 'Landing Page', 'grid', 5, ['landing page', 'react', 'web design'],
      'One focused page for a product launch or campaign: copy structure, responsive design, form or WhatsApp lead capture, and analytics.',
      [['Single page', 22000, 5, 2, ['Responsive', 'Lead form']], ['With copy', 38000, 8, 3, ['Copywriting', 'A/B variant']]]),
    gig('g-meta', 'u-f4', 'digital-marketing', 'meta-ads', 'I will run Meta ads that bring real leads and sales', 'Meta Ads', 'bars', 6, ['meta ads', 'facebook ads', 'leads'],
      'Campaign setup and management on Facebook and Instagram: audience research, pixel check, ad creatives brief and weekly reporting. Ad spend is paid separately to Meta.',
      [['Setup', 12000, 3, 1, ['1 campaign', 'Pixel check']], ['Monthly', 40000, 30, 2, ['Up to 3 campaigns', 'Weekly reports']]]),
    gig('g-social', 'u-f1', 'graphic-design', 'social-media-design', 'I will design 15 branded social media posts', 'Social Posts', 'wave', 7, ['instagram', 'social media', 'posts'],
      'Fifteen on-brand posts and story templates designed in Canva or Figma so your team can reuse them every week.',
      [['15 posts', 9000, 4, 2, ['15 designs', 'Editable templates']], ['30 posts', 16000, 7, 3, ['30 designs', 'Story templates']]]),
  ];
  const pending = gig('g-pending', 'u-f4', 'digital-marketing', null, 'I will set up Google Ads search campaigns for your business', 'Google Ads', 'rings', 8, ['google ads', 'ppc'],
    'Search campaign setup with keyword research, ad copy, conversion tracking and a two-week optimisation period.', [['Setup', 15000, 4, 1, ['Keyword research', '1 campaign']]], { status: 'pending_review', published_at: null });
  const gigs = [...G.map((g) => g[0]), pending[0]];
  const gig_packages = [...G.flatMap((g) => g[1]), ...pending[1]];

  const portfolio_items = [
    { id: 'pf1', freelancer_id: 'u-f1', title: 'Chai Khana — café rebrand', description: 'New logo, menu and storefront signage for a Lahore café.', media: [{ url: cover(9, 'Chai Khana', 'rings'), type: 'image' }], link_url: null, is_published: true, created_at: at(40 * D), updated_at: at(40 * D) },
    { id: 'pf2', freelancer_id: 'u-f1', title: 'Noor Skincare packaging', description: 'Label system for a seven-product skincare range.', media: [{ url: cover(10, 'Noor Skincare', 'grid'), type: 'image' }], link_url: null, is_published: true, created_at: at(70 * D), updated_at: at(70 * D) },
  ];
  (gigs[0] as Row).portfolio_ids = ['pf1', 'pf2'];

  const ord = (id: string, num: string, client: string, f: string, gigId: string | null, pkg: string | null, title: string, tier: string | null, price: number, days: number, status: string, pay: string, extra: Row = {}): Row => {
    const fee = price <= 5000 ? 0 : Math.round(price * 0.03), com = Math.round(price * 0.1);
    return { id, order_number: num, client_id: client, freelancer_id: f, gig_id: gigId, package_id: pkg, offer_id: null, title, package_tier: tier, discount_amount: 0, coupon_id: null,
      requirements: 'Business name: Sana’s Kitchen. Home-style food delivery in Lahore. We like warm colours and simple, friendly shapes.', requirement_files: [], currency: 'PKR',
      price, service_fee: fee, total_amount: price + fee, commission_rate: 0.1, commission_amount: com, freelancer_earning: price - com, delivery_days: days, due_at: null, status,
      status_before_dispute: null, payment_status: pay, revision_count: 0, revision_limit: 2, accepted_at: null, delivered_at: null, completed_at: null, cancelled_at: null,
      cancel_reason: null, deadline_reminded: false, created_at: at(5 * D), updated_at: at(H), ...extra };
  };
  const orders = [
    ord('o1', 'HN-2610-1041', 'u-client', 'u-f1', 'g-logo', 'g-logo-p1', 'I will design a modern minimalist logo for your brand', 'standard', 14000, 5, 'active', 'paid', { accepted_at: at(2 * D), due_at: inFuture(2 * D + 5 * H), revision_limit: 4, updated_at: at(2 * D) }),
    ord('o2', 'HN-2610-1038', 'u-client', 'u-f2', 'g-reels', 'g-reels-p1', 'I will edit scroll-stopping reels, TikToks and shorts', 'standard', 15000, 5, 'delivered', 'paid', { accepted_at: at(6 * D), delivered_at: at(3 * H), revision_limit: 3, created_at: at(7 * D), updated_at: at(3 * H) }),
    ord('o3', 'HN-2609-1012', 'u-client', 'u-f3', 'g-shopify', 'g-shopify-p0', 'I will build a fast Shopify store that converts', 'basic', 35000, 7, 'completed', 'paid', { accepted_at: at(30 * D), delivered_at: at(22 * D), completed_at: at(21 * D), created_at: at(31 * D), updated_at: at(21 * D) }),
    ord('o4', 'HN-2610-1049', 'u-client', 'u-f4', 'g-meta', 'g-meta-p0', 'I will run Meta ads that bring real leads and sales', 'basic', 12000, 3, 'pending_payment', 'unpaid', { created_at: at(20 * 60_000), updated_at: at(20 * 60_000) }),
    ord('o5', 'HN-2610-1047', 'u-c2', 'u-f1', 'g-social', 'g-social-p0', 'I will design 15 branded social media posts', 'basic', 9000, 4, 'pending_acceptance', 'paid', { requirements: 'Usman Electronics — 15 posts for our winter sale. Logo and product photos attached in chat.', created_at: at(5 * H), updated_at: at(2 * H) }),
    ord('o6', 'HN-2609-1007', 'u-c2', 'u-f1', 'g-logo', 'g-logo-p0', 'I will design a modern minimalist logo for your brand', 'basic', 6000, 3, 'completed', 'paid', { accepted_at: at(40 * D), completed_at: at(35 * D), created_at: at(41 * D), updated_at: at(35 * D) }),
    ord('o7', 'HN-2610-1050', 'u-c2', 'u-f2', 'g-motion', 'g-motion-p1', 'I will animate your logo with sound for intros and ads', 'standard', 11000, 5, 'pending_payment', 'awaiting_verification', { created_at: at(2 * H), updated_at: at(H) }),
    ord('o8', 'HN-2610-1033', 'u-c2', 'u-f3', 'g-landing', 'g-landing-p0', 'I will design and develop a high-converting landing page', 'basic', 22000, 5, 'disputed', 'paid', { status_before_dispute: 'active', accepted_at: at(9 * D), due_at: at(4 * D), created_at: at(10 * D), updated_at: at(D) }),
    ord('o9', 'HN-2609-1020', 'u-c2', 'u-f1', 'g-brand', 'g-brand-p0', 'I will create a complete brand identity and style guide', 'basic', 25000, 7, 'completed', 'paid', { accepted_at: at(20 * D), completed_at: at(3 * D), created_at: at(21 * D), updated_at: at(3 * D) }),
  ];
  const ev = (o: string, actor: string | null, event: string, to: string | null, ago: number, note: string | null = null) => ({ id: Math.floor(Math.random() * 1e9), order_id: o, actor_id: actor, event, from_status: null, to_status: to, note, created_at: at(ago) });
  const order_events = [
    ev('o1', 'u-client', 'Order placed', 'pending_payment', 5 * D, 'Brand Mark package'), ev('o1', 'u-client', 'Bank transfer submitted — awaiting verification', null, 4 * D + 20 * H, 'IBFT 88123401'),
    ev('o1', 'u-admin', 'Payment confirmed', 'pending_acceptance', 3 * D), ev('o1', 'u-f1', 'Order accepted — work started', 'active', 2 * D),
    ev('o2', 'u-client', 'Order placed', 'pending_payment', 7 * D), ev('o2', 'u-admin', 'Payment confirmed', 'pending_acceptance', 6 * D + 5 * H), ev('o2', 'u-f2', 'Order accepted — work started', 'active', 6 * D), ev('o2', 'u-f2', 'Work delivered', 'delivered', 3 * H),
    ev('o3', 'u-client', 'Order placed', 'pending_payment', 31 * D), ev('o3', 'u-admin', 'Payment confirmed', 'pending_acceptance', 30 * D + 6 * H), ev('o3', 'u-f3', 'Order accepted — work started', 'active', 30 * D), ev('o3', 'u-f3', 'Work delivered', 'delivered', 22 * D), ev('o3', 'u-client', 'Order completed', 'completed', 21 * D, 'Approved by client'),
    ev('o4', 'u-client', 'Order placed', 'pending_payment', 20 * 60_000, 'Setup package'),
    ev('o5', 'u-c2', 'Order placed', 'pending_payment', 5 * H), ev('o5', 'u-admin', 'Payment confirmed', 'pending_acceptance', 2 * H),
    ev('o6', 'u-c2', 'Order completed', 'completed', 35 * D), ev('o9', 'u-c2', 'Order completed', 'completed', 3 * D),
    ev('o7', 'u-c2', 'Order placed', 'pending_payment', 2 * H), ev('o7', 'u-c2', 'Jazzcash payment submitted — awaiting verification', null, H, 'TID 041256789'),
    ev('o8', 'u-c2', 'Order accepted — work started', 'active', 9 * D), ev('o8', 'u-c2', 'Dispute opened', 'disputed', D, 'late'),
  ];
  const deliveries = [{ id: 'd1', order_id: 'o2', freelancer_id: 'u-f2', message: 'Hi Sana! Here are your 5 reels with captions and music. Let me know if you’d like any changes to pacing or text.', files: [{ path: 'o2/u-f2/reels.zip', name: 'sanas-kitchen-reels.zip', size: 48_200_000 }], revision_number: 0, created_at: at(3 * H) }];
  const reviews = [
    { id: 'r1', order_id: 'o3', gig_id: 'g-shopify', client_id: 'u-client', freelancer_id: 'u-f3', rating: 5, comment: 'Store was live in a week and COD works perfectly. Very clear communication.', response: 'Thank you Sana, great working with you!', response_at: at(20 * D), is_hidden: false, created_at: at(21 * D) },
    { id: 'r2', order_id: 'o6', gig_id: 'g-logo', client_id: 'u-c2', freelancer_id: 'u-f1', rating: 5, comment: 'Exactly the clean look we wanted. Quick revisions too.', response: null, response_at: null, is_hidden: false, created_at: at(35 * D) },
    { id: 'r3', order_id: 'o9', gig_id: 'g-brand', client_id: 'u-c2', freelancer_id: 'u-f1', rating: 5, comment: 'The style guide made it easy for our team to stay consistent.', response: null, response_at: null, is_hidden: false, created_at: at(3 * D) },
    { id: 'r4', order_id: 'o-x', gig_id: 'g-reels', client_id: 'u-client', freelancer_id: 'u-f2', rating: 4, comment: 'Good energy in the edits, one revision needed for captions.', response: null, response_at: null, is_hidden: false, created_at: at(50 * D) },
  ];
  const payments = [
    { id: 'pay1', order_id: 'o1', client_id: 'u-client', amount: 14420, currency: 'PKR', method: 'bank_transfer', provider: null, status: 'paid', reference: 'PAY-7F3A21C9B0E4', provider_txn_id: null, payer_reference: 'IBFT 88123401', payer_name: 'Sana Tariq', proof_path: 'o1/u-client/receipt.png', submitted_at: at(4 * D + 20 * H), verified_by: 'u-admin', verified_at: at(3 * D), rejection_reason: null, created_at: at(4 * D + 20 * H) },
    { id: 'pay2', order_id: 'o2', client_id: 'u-client', amount: 15450, currency: 'PKR', method: 'bank_transfer', provider: null, status: 'paid', channel: 'easypaisa', reference: 'PAY-19BC07D5E2A8', provider_txn_id: null, payer_reference: 'EP 4410983', payer_name: 'Sana Tariq', proof_path: 'o2/u-client/receipt.png', submitted_at: at(6 * D + 8 * H), verified_by: 'u-admin', verified_at: at(6 * D + 5 * H), rejection_reason: null, created_at: at(6 * D + 8 * H) },
    { id: 'pay3', order_id: 'o3', client_id: 'u-client', amount: 36050, currency: 'PKR', method: 'bank_transfer', provider: null, status: 'paid', reference: 'PAY-0D4E8F21A7C3', provider_txn_id: null, payer_reference: 'IBFT 70011289', payer_name: 'Sana Tariq', proof_path: null, submitted_at: at(30 * D + 9 * H), verified_by: 'u-admin', verified_at: at(30 * D + 6 * H), rejection_reason: null, created_at: at(30 * D + 9 * H) },
    { id: 'pay7', order_id: 'o7', client_id: 'u-c2', amount: 11330, currency: 'PKR', method: 'bank_transfer', provider: null, status: 'awaiting_verification', channel: 'jazzcash', reference: 'PAY-A81F2C44D9B1', provider_txn_id: null, payer_reference: 'TID 041256789', payer_name: 'Usman Ali', proof_path: 'o7/u-c2/receipt.png', submitted_at: at(H), verified_by: null, verified_at: null, rejection_reason: null, created_at: at(H) },
  ];
  const ledger_entries = [
    { id: 1, user_id: 'u-f1', order_id: 'o6', withdrawal_id: null, kind: 'order_earning', bucket: 'pending', amount: 5400, description: 'Earning for HN-2609-1007 (PKR 6000 − 10.00% commission)', created_by: 'u-c2', created_at: at(35 * D) },
    { id: 2, user_id: 'u-f1', order_id: 'o6', withdrawal_id: null, kind: 'release', bucket: 'pending', amount: -5400, description: 'Cleared after 7-day clearance', created_by: null, created_at: at(28 * D) },
    { id: 3, user_id: 'u-f1', order_id: 'o6', withdrawal_id: null, kind: 'release', bucket: 'available', amount: 5400, description: 'Cleared after 7-day clearance', created_by: null, created_at: at(28 * D) },
    { id: 4, user_id: 'u-f1', order_id: null, withdrawal_id: 'w1', kind: 'withdrawal_hold', bucket: 'available', amount: -5000, description: 'Withdrawal request', created_by: 'u-f1', created_at: at(25 * D) },
    { id: 5, user_id: 'u-f1', order_id: 'o9', withdrawal_id: null, kind: 'order_earning', bucket: 'pending', amount: 22500, description: 'Earning for HN-2609-1020 (PKR 25000 − 10.00% commission)', created_by: 'u-c2', created_at: at(3 * D) },
    { id: 6, user_id: 'u-f3', order_id: 'o3', withdrawal_id: null, kind: 'order_earning', bucket: 'pending', amount: 31500, description: 'Earning for HN-2609-1012', created_by: 'u-client', created_at: at(21 * D) },
  ];
  const payout_methods = [{ id: 'pm1', user_id: 'u-f1', method: 'jazzcash', account_title: 'Ayesha Malik', bank_name: null, account_number: '03001234567', is_default: true, created_at: at(60 * D) }];
  const withdrawals = [
    { id: 'w1', freelancer_id: 'u-f1', payout_method_id: 'pm1', payout_snapshot: { method: 'jazzcash', account_title: 'Ayesha Malik', account_number: '03001234567' }, amount: 5000, status: 'paid', admin_note: null, reference: 'JC-55120938', processed_by: 'u-admin', paid_at: at(24 * D), created_at: at(25 * D), updated_at: at(24 * D) },
    { id: 'w2', freelancer_id: 'u-f3', payout_method_id: null, payout_snapshot: { method: 'bank_account', account_title: 'Hamza Qureshi', bank_name: 'Meezan Bank', account_number: 'PK00MEZN0000000000000000' }, amount: 20000, status: 'requested', admin_note: null, reference: null, processed_by: null, paid_at: null, created_at: at(6 * H), updated_at: at(6 * H) },
  ];
  ledger_entries.push(
    { id: 7, user_id: 'u-f3', order_id: 'o3', withdrawal_id: null, kind: 'release', bucket: 'pending', amount: -31500, description: 'Cleared after 7-day clearance', created_by: null, created_at: at(14 * D) },
    { id: 8, user_id: 'u-f3', order_id: 'o3', withdrawal_id: null, kind: 'release', bucket: 'available', amount: 31500, description: 'Cleared after 7-day clearance', created_by: null, created_at: at(14 * D) },
    { id: 9, user_id: 'u-f3', order_id: null, withdrawal_id: 'w2', kind: 'withdrawal_hold', bucket: 'available', amount: -20000, description: 'Withdrawal request', created_by: 'u-f3', created_at: at(6 * H) },
  );

  const conversations = [
    { id: 'c1', created_by: 'u-client', order_id: 'o1', gig_id: 'g-logo', last_message_at: at(40 * 60_000), last_message_preview: 'Sure — I’ll share the first concepts tomorrow evening.', created_at: at(6 * D) },
    { id: 'c2', created_by: 'u-client', order_id: null, gig_id: null, last_message_at: at(26 * H), last_message_preview: '💼 Custom offer', created_at: at(2 * D) },
    { id: 'c3', created_by: 'u-c2', order_id: 'o5', gig_id: 'g-social', last_message_at: at(2 * H), last_message_preview: 'Paid! Excited to see the posts.', created_at: at(6 * H) },
  ];
  const conversation_participants = [
    { conversation_id: 'c1', user_id: 'u-client', last_read_at: at(30 * 60_000), joined_at: at(6 * D) }, { conversation_id: 'c1', user_id: 'u-f1', last_read_at: at(40 * 60_000), joined_at: at(6 * D) },
    { conversation_id: 'c2', user_id: 'u-client', last_read_at: at(30 * H), joined_at: at(2 * D) }, { conversation_id: 'c2', user_id: 'u-f4', last_read_at: at(26 * H), joined_at: at(2 * D) },
    { conversation_id: 'c3', user_id: 'u-c2', last_read_at: at(2 * H), joined_at: at(6 * H) }, { conversation_id: 'c3', user_id: 'u-f1', last_read_at: at(5 * H), joined_at: at(6 * H) },
  ];
  const msg = (id: string, c: string, s: string | null, body: string, ago: number, extra: Row = {}) => ({ id, conversation_id: c, sender_id: s, kind: 'text', body, reply_to_id: null, attachment_path: null, attachment_name: null, attachment_mime: null, attachment_size: null, duration_seconds: null, offer_id: null, request_id: null, call_id: null, created_at: at(ago), deleted_at: null, ...extra });
  const messages = [
    msg('m1', 'c1', 'u-client', 'Hi Ayesha! I love your logo portfolio. Can you do something warm for a home-food delivery brand?', 6 * D),
    msg('m2', 'c1', 'u-f1', 'Hi Sana, absolutely. Warm tones and a friendly mark would suit that well. The Brand Mark package gives you 3 concepts.', 6 * D - 20 * 60_000),
    msg('m3', 'c1', 'u-client', 'Perfect, I just placed the order 🙌', 5 * D),
    msg('m4', 'c1', null, 'Payment confirmed. Order HN-2610-1041 is now active.', 3 * D, { kind: 'system' }),
    msg('m5', 'c1', 'u-client', 'Hi! Any chance to see a first draft this week?', 60 * 60_000),
    msg('m6', 'c1', 'u-f1', 'Sure — I’ll share the first concepts tomorrow evening.', 40 * 60_000, { reply_to_id: 'm5' }),
    msg('m7', 'c2', 'u-client', 'Hello Mehwish, can you run ads for our food delivery launch in Lahore?', 2 * D),
    msg('m8', 'c2', 'u-client', 'Launch campaign for Sana’s Kitchen', 2 * D - 60_000, { kind: 'request', request_id: 'rq1' }),
    msg('m9', 'c2', 'u-f4', 'Thanks for the details! I’ve sent you an offer for a two-week launch campaign.', 26 * H + 60_000),
    msg('m10', 'c2', 'u-f4', 'Two-week launch campaign', 26 * H, { kind: 'offer', offer_id: 'of1' }),
    msg('m11', 'c3', 'u-c2', 'Assalam o Alaikum! Ordered the 15 posts package for our winter sale.', 5 * H),
    msg('m12', 'c3', 'u-c2', 'Paid! Excited to see the posts.', 2 * H),
  ];
  const custom_requests = [{ id: 'rq1', client_id: 'u-client', freelancer_id: 'u-f4', conversation_id: 'c2', title: 'Launch campaign for Sana’s Kitchen', description: 'We launch home-food delivery in DHA and Gulberg next month. Looking for Facebook + Instagram ads to get our first 300 orders.', budget: 30000, deadline: new Date(Date.now() + 20 * D).toISOString().slice(0, 10), attachments: [], status: 'offered', created_at: at(2 * D) }];
  const custom_offers = [{ id: 'of1', conversation_id: 'c2', freelancer_id: 'u-f4', client_id: 'u-client', gig_id: 'g-meta', request_id: 'rq1', title: 'Two-week launch campaign', description: 'Audience research for DHA and Gulberg, 2 ad sets with 6 creatives (you supply photos), pixel check, daily optimisation and 2 weekly reports. Ad spend paid separately to Meta.', price: 28000, delivery_days: 14, revisions: 1, status: 'pending', expires_at: inFuture(6 * D), order_id: null, created_at: at(26 * H) }];

  const n = (id: string, user: string, type: string, title: string, body: string | null, link: string | null, ago: number, read = false) => ({ id, user_id: user, type, title, body, link, is_read: read, emailed: false, created_at: at(ago) });
  const notifications = [
    n('n1', 'u-client', 'delivery', 'Your order was delivered', 'Review the delivery for your reels order', '/app/orders/o2', 3 * H),
    n('n2', 'u-client', 'message', 'New message from Ayesha Malik', 'Sure — I’ll share the first concepts tomorrow evening.', '/app/messages/c1', 40 * 60_000),
    n('n3', 'u-client', 'custom_offer', 'You received a custom offer', 'Two-week launch campaign', '/app/messages/c2', 26 * H, true),
    n('n4', 'u-f1', 'new_order', 'New order — please accept', 'I will design 15 branded social media posts', '/app/orders/o5', 2 * H),
    n('n5', 'u-f1', 'review', 'New 5-star review', 'I will create a complete brand identity and style guide', '/app/reviews', 3 * D, true),
    n('n6', 'u-f1', 'order_completed', 'Order completed', 'PKR 22500 added to pending earnings', '/app/orders/o9', 3 * D, true),
    n('n7', 'u-admin', 'payment_review', 'Payment awaiting verification', 'HN-2610-1050 · PKR 11330', '/admin/payments', H),
    n('n8', 'u-admin', 'gig_review', 'Gig awaiting review', 'I will set up Google Ads search campaigns for your business', '/admin/gigs', 9 * H),
    n('n9', 'u-admin', 'dispute', 'New dispute', 'HN-2610-1033 · late', '/admin/disputes', D),
  ];
  const disputes = [{ id: 'dp1', order_id: 'o8', opened_by: 'u-c2', reason: 'late', details: 'Delivery was due four days ago and I have not received any update since. I need the page for a campaign starting this week.', status: 'open', resolution: null, outcome: null, resolved_by: null, resolved_at: null, created_at: at(D) }];
  const reports = [{ id: 'rp1', reporter_id: 'u-client', target_type: 'user', target_id: 'u-f4', reason: 'off_platform_payment', details: 'Sample report: asked to pay by direct transfer to get a discount.', status: 'open', admin_note: null, handled_by: null, created_at: at(10 * H) }];
  const contact_messages = [{ id: 'cm1', name: 'Fatima Noor', email: 'fatima@example.com', service: 'Website Design & Development', message: 'Sample enquiry: we need a website for our clinic with appointment booking. What would it cost?', handled: false, created_at: at(4 * H) }];
  const audit_logs = [
    { id: 1, actor_id: 'u-admin', action: 'payment.approve', entity: 'payment', entity_id: 'pay1', details: { order_id: 'o1', amount: 14700 }, created_at: at(3 * D) },
    { id: 2, actor_id: 'u-admin', action: 'withdrawal.paid', entity: 'withdrawal', entity_id: 'w1', details: { amount: 5000, reference: 'JC-55120938' }, created_at: at(24 * D) },
    { id: 3, actor_id: 'u-admin', action: 'gig.approve', entity: 'gig', entity_id: 'g-social', details: {}, created_at: at(21 * D) },
  ];
  const platform_settings = [
    ['commission_rate', 0.1], ['client_service_fee_rate', 0.03], ['clearance_days', 7], ['min_withdrawal', 1000], ['auto_complete_days', 3], ['gig_moderation', true], ['online_payments_enabled', true],
    ['client_fee_free_threshold', 5000], ['level_commission', { rising: 0.09, top: 0.08 }], ['seller_level_rules', { rising: { orders: 5, rating: 4.5 }, top: { orders: 25, rating: 4.7, reviews: 10 } }],
    ['founding_program', { enabled: true, commission_rate: 0, months: 3, slots: 50 }], ['late_compensation_rate', 0.1], ['referral_reward', { enabled: true, amount: 500, min_order: 2000 }],
    ['payout_sla_days', 3], ['company_info', { legal_name: '', registration: '', ntn: '', address: '' }], ['booking_url', ''], ['support_hours', 'Mon–Sat, 10am–7pm (PKT)'],
    ['online_gateway', { provider: 'safepay', label: 'Card, JazzCash or Easypaisa', methods: ['card', 'jazzcash', 'easypaisa'] }],
    ['payment_channels', { bank: { enabled: true }, jazzcash: { enabled: true, account_title: 'HN Creative Agency (sample)', number: '03000000000' },
      easypaisa: { enabled: true, account_title: 'HN Creative Agency (sample)', number: '03450000000' }, raast: { enabled: true, account_title: 'HN Creative Agency (sample)', raast_id: '03000000000' } }],
    ['bank_instructions', { account_title: 'HN Creative Agency (sample)', bank_name: 'Sample Bank — preview only', iban: 'PK00SAMP0000000000000000', account_number: '', notes: 'Preview only — this is not a real account. Use your order number as the payment reference.' }],
    ['site_contact', { email: 'hncreativeagencyhr@gmail.com', phone: '+92 317 6250671', whatsapp: '923176250671', address: 'Thoker Niaz Baig, Lahore, Pakistan 53700' }],
  ].map(([key, value]) => ({ key, value, updated_at: at(D), updated_by: null }));

  return {
    profiles, profile_private: profiles.map((p, i) => ({ id: p.id, phone: null, whatsapp: null, email_notifications: true, whatsapp_notifications: false, referral_code: `HN${(4821 + i * 137).toString(36).toUpperCase()}`, referred_by: p.id === 'u-c2' ? 'u-client' : null, last_seen_at: at(p.id === 'u-f1' ? 10 * 60_000 : 3 * H), updated_at: at(D) })),
    categories, gigs, gig_packages, portfolio_items, favorite_gigs: [{ user_id: 'u-client', gig_id: 'g-brand', created_at: at(4 * D) }], saved_freelancers: [{ user_id: 'u-client', freelancer_id: 'u-f1', created_at: at(6 * D) }],
    orders, order_events, deliveries, revision_requests: [], reviews, payments, payment_events: [], refunds: [], ledger_entries, payout_methods, withdrawals,
    conversations, conversation_participants, messages, custom_requests, custom_offers, calls: [], call_events: [], user_blocks: [], notifications, disputes, reports,
    audit_logs, platform_settings, contact_messages,
    coupons: [
      { id: 'cp1', code: 'WELCOME10', description: '10% off your first order (up to PKR 1,000)', kind: 'percent', value: 10, max_discount: 1000, min_order: 1000, first_order_only: true, owner_id: null, max_uses: null, used_count: 3, expires_at: null, is_active: true, source: 'admin', created_at: at(30 * D) },
      { id: 'cp2', code: 'EID15', description: 'Eid offer — 15% off up to PKR 2,000', kind: 'percent', value: 15, max_discount: 2000, min_order: 3000, first_order_only: false, owner_id: null, max_uses: 200, used_count: 12, expires_at: inFuture(20 * D), is_active: true, source: 'admin', created_at: at(5 * D) },
      { id: 'cp3', code: 'LATE-7Q2K9A', description: 'Credit for late delivery on HN-2610-1033', kind: 'amount', value: 2200, max_discount: null, min_order: 0, first_order_only: false, owner_id: 'u-c2', max_uses: 1, used_count: 0, expires_at: inFuture(85 * D), is_active: true, source: 'late_delivery', created_at: at(D) },
      { id: 'cp4', code: 'REF-K3M8Q1', description: 'Referral reward', kind: 'amount', value: 500, max_discount: null, min_order: 0, first_order_only: false, owner_id: 'u-client', max_uses: 1, used_count: 0, expires_at: inFuture(60 * D), is_active: true, source: 'referral', created_at: at(30 * D) },
    ],
    coupon_redemptions: [],
    job_posts: [
      { id: 'jp1', client_id: 'u-client', title: 'Packaging design for Sana’s Kitchen meal boxes', description: 'We need a simple, warm design for our takeaway meal boxes (3 sizes) and a matching sticker. Our logo and colours are ready. Printing will be done in Lahore, so files must be print-ready (CMYK, bleed).', category_id: 'cat-graphic-design', budget_min: 8000, budget_max: 15000, delivery_days: 7, status: 'open', proposals_count: 2, expires_at: inFuture(27 * D), created_at: at(3 * D), updated_at: at(D) },
      { id: 'jp2', client_id: 'u-c2', title: 'Urdu captions for 10 product reels', description: 'Usman Electronics has 10 short product videos (20–40 sec). We need Urdu + English captions burned in, our logo at the end, and vertical exports for Instagram and TikTok.', category_id: 'cat-video-editing', budget_min: 6000, budget_max: 12000, delivery_days: 5, status: 'open', proposals_count: 0, expires_at: inFuture(29 * D), created_at: at(20 * H), updated_at: at(20 * H) },
      { id: 'jp3', client_id: 'u-c2', title: 'Speed up our Shopify store (mobile score under 40)', description: 'Our Shopify store loads slowly on mobile. We want a speed audit, image compression, app clean-up and theme fixes. Please share before/after scores from previous work.', category_id: 'cat-website-design-development', budget_min: 15000, budget_max: 30000, delivery_days: 10, status: 'open', proposals_count: 1, expires_at: inFuture(25 * D), created_at: at(5 * D), updated_at: at(2 * D) },
    ],
    job_proposals: [
      { id: 'pp1', job_id: 'jp1', freelancer_id: 'u-f1', cover_letter: 'Assalam o Alaikum Sana! I designed your logo concepts so I already know the brand. I’ll create a print-ready box system for all 3 sizes plus the sticker, with 2 rounds of revisions and a mock-up so you can see it before printing.', price: 12000, delivery_days: 6, revisions: 2, status: 'pending', order_id: null, created_at: at(2 * D) },
      { id: 'pp2', job_id: 'jp1', freelancer_id: 'u-f4', cover_letter: 'I work with several food brands on packaging and launch ads. I can design the boxes and also prepare 3 launch post designs to announce the new packaging on Instagram.', price: 14500, delivery_days: 7, revisions: 2, status: 'pending', order_id: null, created_at: at(D) },
      { id: 'pp3', job_id: 'jp3', freelancer_id: 'u-f3', cover_letter: 'I’ve optimised 20+ Shopify stores in Pakistan. Typical result: mobile score from 30s to 70+. I’ll audit apps, compress images, defer scripts and fix the theme. Before/after report included.', price: 22000, delivery_days: 8, revisions: 1, status: 'pending', order_id: null, created_at: at(3 * D) },
    ],
    leads: [
      { id: 'ld1', kind: 'consultation', name: 'Ali Raza', email: 'ali@example.com', phone: '0300 1234567', company: 'Raza Dental Clinic', service: 'Website / Shopify store', package: null, budget: '50,000 – 150,000', preferred_date: inFuture(2 * D).slice(0, 10), preferred_time: '11:00 – 12:00', message: 'Sample lead: website with appointment booking.', status: 'new', admin_note: null, user_id: null, created_at: at(4 * H) },
      { id: 'ld2', kind: 'agency_package', name: 'Hira Shah', email: 'hira@example.com', phone: '0321 7654321', company: 'Hira Boutique', service: null, package: 'Growth (PKR 15,000)', budget: null, preferred_date: null, preferred_time: null, message: null, status: 'contacted', admin_note: 'Called — sending scope on WhatsApp', user_id: null, created_at: at(D) },
    ],
    verification_requests: [
      { id: 'vr1', user_id: 'u-f2', legal_name: 'Bilal Ahmed', id_front_path: 'u-f2/cnic-front.jpg', id_back_path: 'u-f2/cnic-back.jpg', sample_links: ['https://www.youtube.com/@example', 'https://www.instagram.com/example'], notes: 'Sample request for the preview.', status: 'pending', admin_note: null, reviewed_by: null, reviewed_at: null, created_at: at(6 * H) },
    ],
    gig_stats: ['g-logo', 'g-social', 'g-brand'].flatMap((gid, gi) => Array.from({ length: 14 }, (_, d) => ({ gig_id: gid, day: new Date(Date.now() - d * D).toISOString().slice(0, 10), views: 18 - gi * 5 + ((d * 7 + gi * 3) % 9), clicks: 2 + ((d + gi) % 3) }))),
  };
}
