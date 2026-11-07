/* Marketing content: service landing pages, PKR package guide, agency plans.
   Prices are HN's recommended starting points (Oct 2026 market check); freelancers set their own gig prices. */

export interface Tier { name: string; price: number; includes: string }
export interface ServiceGuide {
  slug: string;            // URL: /services/<slug>
  category: string;        // marketplace category slug
  name: string;
  short: string;
  icon: string;            // lucide icon name used by CategoryIcon
  title: string;           // SEO title
  description: string;     // SEO description
  intro: string[];
  tiers: [Tier, Tier, Tier];
  marketNote: string;
  deliverables: string[];
  faqs: [string, string][];
  monthly?: boolean;
}

export const SERVICES: ServiceGuide[] = [
  {
    slug: 'logo-design', category: 'logo-brand-identity', name: 'Logo Design', short: 'Logos and brand identity', icon: 'Gem',
    title: 'Logo Design in Pakistan – from PKR 3,000',
    description: 'Hire a verified logo designer in Pakistan. Clear PKR packages from PKR 3,000, source files included in Standard, money-back guarantee.',
    intro: [
      'A good logo is the first thing customers remember. On HN you hire Pakistani designers who show real portfolios, fixed PKR prices and a clear number of concepts and revisions — no surprises.',
      'Small businesses usually start with the Basic package and upgrade to a full brand guide when they print packaging or launch a website.',
    ],
    tiers: [
      { name: 'Basic', price: 3000, includes: '2 concepts · 2 revisions · PNG/JPG' },
      { name: 'Standard', price: 7500, includes: '4 concepts · source files (AI/SVG) · social kit' },
      { name: 'Premium', price: 15000, includes: '6 concepts · brand guide · unlimited revisions' },
    ],
    marketNote: 'Agency logo packages in Pakistan typically run PKR 25,000–125,000.',
    deliverables: ['Original concepts — no templates', 'Colour, black and white versions', 'Files ready for print and social media', 'Full ownership after the order is completed'],
    faqs: [
      ['How many revisions do I get?', 'Each package states its revisions. Basic includes 2; Premium includes unlimited revisions within the agreed scope.'],
      ['Do I own the logo?', 'Yes. Ownership of the final files transfers to you when the order is completed and paid.'],
      ['What if I don’t like any concept?', 'Ask for revisions within your package. If the work still doesn’t match the brief, open a dispute — our money-back guarantee applies.'],
    ],
  },
  {
    slug: 'website-development', category: 'website-design-development', name: 'Website Development', short: 'Business sites, landing pages, Shopify', icon: 'MonitorSmartphone',
    title: 'Website Development in Pakistan – Landing Pages from PKR 15,000',
    description: 'Business websites, landing pages and Shopify stores built by verified Pakistani developers. Fixed PKR packages, mobile-friendly, SEO basics included.',
    intro: [
      'Get a fast, mobile-friendly website without paying agency overheads. Developers on HN quote in PKR, show live examples and deliver in clear milestones.',
      'Need more than a website? Our agency team can manage the project end-to-end with a single project manager.',
    ],
    tiers: [
      { name: 'Basic', price: 15000, includes: '1-page landing page · contact/WhatsApp button' },
      { name: 'Standard', price: 30000, includes: '5-page business site · responsive · basic SEO' },
      { name: 'Premium', price: 60000, includes: 'Corporate site · SEO basics · analytics setup' },
    ],
    marketNote: 'Typical market range in Pakistan: PKR 20,000–120,000 depending on pages and features.',
    deliverables: ['Mobile-first, fast-loading pages', 'Contact form or WhatsApp lead capture', 'Google Analytics and Search Console setup on request', 'Handover of logins and source'],
    faqs: [
      ['Is hosting and domain included?', 'Usually not — they are paid to the provider in your name. Many developers help you set them up as an extra.'],
      ['Can you build a Shopify store?', 'Yes. Search for Shopify gigs or post a request with your product count and payment needs (COD, JazzCash, Easypaisa).'],
      ['What if the website is late?', 'Delivery dates are tracked on the order. Late deliveries earn you an automatic credit, and you can open a dispute if needed.'],
    ],
  },
  {
    slug: 'video-editing', category: 'video-editing', name: 'Video Editing', short: 'Reels, Shorts, TikToks and ads', icon: 'Clapperboard',
    title: 'Video Editing in Pakistan – Reels from PKR 3,000',
    description: 'Scroll-stopping reels, TikToks, YouTube Shorts and ad videos edited by Pakistani editors. Subtitles, music and motion graphics in clear PKR packages.',
    intro: [
      'Short-form video sells. Send your raw clips and get ready-to-post reels with hooks, captions and sound design.',
      'Order a single reel to test an editor, then move to a monthly bundle once you like the style.',
    ],
    tiers: [
      { name: 'Basic', price: 3000, includes: '1 short video · captions' },
      { name: 'Standard', price: 6000, includes: '1 video · subtitles · music & colour' },
      { name: 'Premium', price: 12000, includes: 'Motion graphics · advanced edit · thumbnail' },
    ],
    marketNote: 'Studios in Lahore advertise short videos from around PKR 3,000 each.',
    deliverables: ['Vertical and horizontal exports', 'Urdu or English subtitles', 'Licensed or royalty-free music', 'Source project on request'],
    faqs: [
      ['How do I send footage?', 'Upload files in the order chat or share a Google Drive link.'],
      ['Can I get Urdu captions?', 'Yes — mention it in your requirements. Many editors offer Urdu and English captions.'],
      ['How fast is delivery?', 'Most reels are delivered in 1–3 days. Express delivery is often available as an extra.'],
    ],
  },
  {
    slug: 'social-media-marketing', category: 'social-media-management', name: 'Social Media', short: 'Posts, management and growth', icon: 'Share2',
    title: 'Social Media Management in Pakistan – from PKR 10,000/month',
    description: 'Monthly social media management and post design for Pakistani businesses. Facebook, Instagram and TikTok packages in PKR.',
    intro: [
      'Stay consistent on Facebook, Instagram and TikTok without hiring a full-time team. Choose a post-design package or a full monthly management plan.',
      'Post design starts at PKR 2,000 for 5 posts; full management with ads starts at PKR 20,000 per month.',
    ],
    tiers: [
      { name: 'Basic', price: 10000, includes: '12 posts/month · 2 platforms' },
      { name: 'Standard', price: 20000, includes: '20 posts · 1 ad campaign' },
      { name: 'Premium', price: 35000, includes: '30 posts + reels · 2 ad campaigns' },
    ],
    marketNote: 'Market range in Pakistan: PKR 10,000–100,000 per month. Post design only: from PKR 2,000 for 5 posts.',
    deliverables: ['Content calendar for approval', 'On-brand post and story designs', 'Captions in English or Urdu', 'Monthly performance summary'],
    faqs: [
      ['Is ad spend included?', 'No. Ad budget is paid directly to Meta or TikTok; packages cover the work of running the campaigns.'],
      ['Can I approve posts before they go live?', 'Yes. Managers share a calendar for your approval each week or month.'],
      ['Is there a contract?', 'Monthly packages are ordered one month at a time. Cancel anytime before the next order.'],
    ],
    monthly: true,
  },
  {
    slug: 'ads-management', category: 'digital-marketing', name: 'Ads Management', short: 'Meta, Google and TikTok ads', icon: 'Megaphone',
    title: 'Meta & Google Ads Management in Pakistan',
    description: 'Facebook, Instagram, Google and TikTok ads run by experienced Pakistani marketers. Pixel setup, audience research and weekly reports in PKR packages.',
    intro: [
      'Turn ad spend into leads and sales. Marketers on HN set up tracking properly, test creatives and report results every week.',
      'Not sure where to start? Book a free consultation and our agency team will recommend a budget and channel.',
    ],
    tiers: [
      { name: 'Basic', price: 8000, includes: '1 campaign setup · pixel check' },
      { name: 'Standard', price: 20000, includes: 'Up to 3 campaigns · weekly report' },
      { name: 'Premium', price: 40000, includes: 'Full-funnel campaigns · creatives brief · optimisation' },
    ],
    marketNote: 'Ad budget is paid separately to the ad platform.',
    deliverables: ['Pixel / conversion tracking check', 'Audience and keyword research', 'A/B tested ad sets', 'Clear weekly reporting'],
    faqs: [
      ['How much should I spend on ads?', 'Many small businesses start with PKR 1,000–3,000 per day. Your marketer will recommend a budget for your goal.'],
      ['Do you guarantee sales?', 'Nobody can honestly guarantee sales from ads. We guarantee the agreed work is delivered — or your money back.'],
      ['Do I keep access to my ad account?', 'Always. Campaigns run in your own ad account; never share your password — give partner access instead.'],
    ],
  },
];

export const serviceBySlug = (slug?: string) => SERVICES.find((s) => s.slug === slug);

export interface AgencyPlan { id: string; name: string; price: number | null; tagline: string; includes: string[]; hot?: boolean }
/** Managed agency bundles (all in PKR). Replace the old USD $299 / $799 plans. */
export const AGENCY_PLANS: AgencyPlan[] = [
  { id: 'starter', name: 'Starter', price: 3000, tagline: 'Start with a professional logo', includes: ['Basic logo — 2 concepts', '2 revisions', 'PNG & JPG files'] },
  { id: 'growth', name: 'Growth', price: 15000, tagline: 'Look professional on social media', includes: ['Standard logo with source files', '15 social media post designs', 'Facebook & Instagram page setup'], hot: true },
  { id: 'business', name: 'Business', price: 50000, tagline: 'Everything to launch online', includes: ['Logo & brand basics', '5-page business website', '12 social media post designs', 'Dedicated project manager'] },
  { id: 'enterprise', name: 'Enterprise', price: null, tagline: 'Brand, website and monthly marketing', includes: ['Complete brand identity', 'Custom website', 'Monthly social media & ads', 'Quarterly strategy review'] },
];
