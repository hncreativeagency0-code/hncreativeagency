/* SEO blog articles. Add a new object to publish a post — the sitemap script picks it up automatically.
   Prices quoted are typical ranges seen in October 2026; always check current offers. */

export interface BlogSection { h?: string; p?: string[]; ul?: string[]; table?: { head: string[]; rows: string[][] } }
export interface BlogPost {
  slug: string; title: string; description: string; date: string; readMins: number; tag: string;
  service?: string;          // related /services/<slug> page
  sections: BlogSection[];
}

export const POSTS: BlogPost[] = [
  {
    slug: 'logo-design-price-in-pakistan',
    title: 'Logo Design Price in Pakistan (2026): What Should You Pay?',
    description: 'Real logo design prices in Pakistan for 2026 — freelancer vs agency, what each package should include, and how to avoid paying twice.',
    date: '2026-10-20', readMins: 5, tag: 'Pricing guide', service: 'logo-design',
    sections: [
      { p: ['“How much does a logo cost?” is the first question most small business owners ask us. The honest answer: anywhere from a few thousand rupees to well over a lakh. The difference is not only the designer’s skill — it is what you actually receive.'] },
      { h: 'Typical logo prices in Pakistan', table: { head: ['Option', 'Typical price (PKR)', 'Best for'], rows: [
        ['Freelancer — basic', '3,000 – 5,000', 'New shops, home businesses, testing an idea'],
        ['Freelancer — with source files', '7,500 – 15,000', 'Businesses that will print signage or packaging'],
        ['Agency logo package', '25,000 – 125,000', 'Brands that need research, strategy and a full identity'],
      ] } },
      { h: 'What a fair package includes', ul: [
        'A clear number of original concepts (not one design with three colours).',
        'A stated number of revisions — “unlimited” is usually only fair in premium packages.',
        'Final files in PNG and JPG, plus vector source files (AI, SVG or PDF) at the standard level.',
        'Written confirmation that you own the final logo once you have paid.',
      ] },
      { h: 'Red flags', ul: [
        'No portfolio, or a portfolio full of famous brand logos the designer obviously did not make.',
        'Asking you to pay the full amount directly to a personal JazzCash number with no record.',
        'Templates sold as “custom” work — ask for the concept sketches.',
      ] },
      { h: 'How to get the most from your budget', p: [
        'Write a short brief: your business name, who your customers are, three logos you like and why. Designers work faster — and cheaper — when they know what you want.',
        'Start with a basic package if money is tight. You can always upgrade to a full brand guide when you launch packaging or a website.',
      ] },
      { h: 'Hiring on HN', p: ['On HN Creative Agency, logo packages start from PKR 3,000. Your payment is held safely until you approve the delivery, and if the work is not delivered as agreed, our money-back guarantee applies.'] },
    ],
  },
  {
    slug: 'website-cost-in-pakistan',
    title: 'How Much Does a Website Cost in Pakistan in 2026?',
    description: 'Website prices in Pakistan explained: landing pages, business sites, Shopify stores and corporate websites, plus the hidden costs nobody mentions.',
    date: '2026-10-18', readMins: 6, tag: 'Pricing guide', service: 'website-development',
    sections: [
      { p: ['Website quotes in Pakistan can range from PKR 15,000 to several lakh for what sounds like the same thing. This guide breaks down what you are really paying for.'] },
      { h: 'Typical website prices', table: { head: ['Type', 'Typical price (PKR)', 'What you get'], rows: [
        ['Landing page', '15,000 – 25,000', 'One focused page with a contact form or WhatsApp button'],
        ['Basic business website', '35,000 – 60,000', '4–6 pages, mobile-friendly, basic SEO'],
        ['Corporate website', '60,000 – 120,000+', 'Custom design, more pages, blog, analytics'],
        ['Shopify / e-commerce store', '35,000 – 140,000', 'Theme setup, products, COD and wallet payments'],
      ] } },
      { h: 'Costs that are often left out', ul: [
        'Domain name and hosting — renewed every year and best kept in your own name.',
        'Paid themes, plugins or apps.',
        'Content: product photos, copywriting and translations.',
        'Maintenance and updates after launch.',
      ] },
      { h: 'Questions to ask before you pay', ul: [
        'Will the site be mobile-friendly and fast on 4G?',
        'Who owns the code, the domain and the hosting account?',
        'How many rounds of changes are included?',
        'What happens if the deadline is missed?',
      ] },
      { h: 'A safer way to hire', p: ['On HN, website packages start at PKR 15,000 for a landing page. Payments are protected until you approve the delivery, late deliveries earn an automatic credit, and our agency team can take over if a freelancer cannot finish.'] },
    ],
  },
  {
    slug: 'social-media-management-packages-pakistan',
    title: 'Social Media Management Packages in Pakistan: Prices & What’s Included',
    description: 'Compare social media management prices in Pakistan — from PKR 10,000 starter plans to full-service packages — and learn what should be in a monthly plan.',
    date: '2026-10-15', readMins: 5, tag: 'Pricing guide', service: 'social-media-marketing',
    sections: [
      { p: ['Most Pakistani businesses know they should post regularly — few have the time. A monthly social media package solves that, but plans vary a lot.'] },
      { h: 'Typical monthly prices', table: { head: ['Plan', 'Typical price (PKR / month)', 'Usually includes'], rows: [
        ['Starter', '10,000 – 15,000', '10–12 posts, 1–2 platforms'],
        ['Growth', '20,000 – 35,000', '20–30 posts, reels, 1–2 ad campaigns'],
        ['Full service', '50,000 – 100,000', 'Daily content, community management, ads and reporting'],
      ] } },
      { h: 'What a good plan includes', ul: [
        'A monthly content calendar you approve before anything is posted.',
        'Designs that follow your brand colours and fonts.',
        'Captions in the language your customers use — English, Urdu or both.',
        'A short monthly report: reach, engagement and what will change next month.',
      ] },
      { h: 'Ad budget is separate', p: ['Packages cover the work of creating and managing content. Money spent on boosting posts or running ads is paid directly to Meta or TikTok — make sure your quote is clear about this.'] },
      { h: 'Try before you commit', p: ['Start with a design-only package (from PKR 2,000 for 5 posts on HN) to test a designer’s style, then move to monthly management once you are happy.'] },
    ],
  },
  {
    slug: 'video-editing-rates-pakistan',
    title: 'Video Editing Rates in Pakistan for Reels, Shorts and Ads (2026)',
    description: 'What video editors in Pakistan charge for reels, TikToks, YouTube Shorts and ad videos — and how to brief an editor so you get it right the first time.',
    date: '2026-10-12', readMins: 4, tag: 'Pricing guide', service: 'video-editing',
    sections: [
      { p: ['Short-form video is the fastest way to reach customers in Pakistan right now. Here is what editing typically costs and how to get good results.'] },
      { h: 'Typical rates', table: { head: ['Type', 'Typical price (PKR)'], rows: [
        ['Simple reel / short (up to 30 sec)', '3,000 – 4,000'],
        ['Reel with subtitles, music and colour', '5,000 – 8,000'],
        ['Motion graphics or ad video', '10,000 – 20,000+'],
        ['Monthly bundle (10–12 videos)', '25,000 – 40,000'],
      ] } },
      { h: 'How to brief an editor', ul: [
        'Share 2–3 example videos you like and say what you like about them.',
        'Say where the video will be posted — the format and length change.',
        'Send all raw clips, logo and music preferences in one go.',
        'Mention if you need Urdu or English captions.',
      ] },
      { h: 'Order one, then scale', p: ['Test an editor with a single reel before ordering a bundle. On HN, single-reel packages start at PKR 3,000 and your payment is protected until you approve the video.'] },
    ],
  },
  {
    slug: 'hire-freelancer-safely-pakistan',
    title: 'How to Hire a Freelancer Safely in Pakistan (and Avoid Scams)',
    description: 'A practical checklist for hiring freelancers in Pakistan: checking portfolios, protecting your payment, and what to do if the work is not delivered.',
    date: '2026-10-08', readMins: 5, tag: 'Guide',
    sections: [
      { p: ['Hiring a freelancer through a Facebook group or WhatsApp can save money — until the person disappears after an advance payment. Here is how to protect yourself.'] },
      { h: 'Before you hire', ul: [
        'Look for real, recent work — ask for links, not only screenshots.',
        'Check reviews that come from completed orders, not testimonials anyone can type.',
        'Agree on scope in writing: deliverables, revisions, deadline and price.',
      ] },
      { h: 'Protect your payment', ul: [
        'Avoid paying 100% upfront to a personal account with no record.',
        'Use a platform that holds the payment until you approve the delivery.',
        'Keep all communication in one place so there is a record if something goes wrong.',
      ] },
      { h: 'If something goes wrong', p: ['Raise the problem early and politely. If there is still no progress, use the platform’s dispute process. On HN, our team reviews the order history and either gets the work completed — sometimes by our own agency team — or refunds you.'] },
      { h: 'Why we built HN', p: ['HN Creative Agency started as a design and marketing agency in Lahore. We built the marketplace so Pakistani businesses can hire freelancers with local payments, low fees, Urdu support and a simple promise: work done, or your money back.'] },
    ],
  },
];

export const postBySlug = (slug?: string) => POSTS.find((p) => p.slug === slug);
