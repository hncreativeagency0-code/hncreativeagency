-- =====================================================================
-- Default platform settings and starter categories (real config, not demo data)
-- Change any of these from Admin → Settings later.
-- =====================================================================
insert into public.platform_settings (key, value) values
  ('commission_rate',          '0.10'),   -- deducted from freelancer earnings
  ('client_service_fee_rate',  '0.05'),   -- added on top for the client
  ('clearance_days',           '7'),      -- days before completed-order earnings become withdrawable
  ('min_withdrawal',           '1000'),
  ('auto_complete_days',       '3'),      -- delivered orders auto-complete if the client does not respond
  ('gig_moderation',           'true'),   -- new/edited gigs need admin approval
  ('online_payments_enabled',  'false'),  -- flip on only after your gateway is configured and tested
  ('bank_instructions', '{"account_title": "", "bank_name": "", "iban": "", "account_number": "", "notes": "Use your order number as the payment reference."}'),
  ('site_contact', '{"email": "hncreativeagencyhr@gmail.com", "phone": "+92 317 6250671", "whatsapp": "923176250671", "address": "Thoker Niaz Baig, Lahore, Pakistan 53700"}')
on conflict (key) do nothing;

with parents as (
  insert into public.categories (name, slug, description, icon, sort_order) values
    ('Graphic Design', 'graphic-design', 'Social posts, print, presentations and marketing materials', 'PenTool', 1),
    ('Logo & Brand Identity', 'logo-brand-identity', 'Logos, brand systems and guidelines', 'Gem', 2),
    ('Video Editing', 'video-editing', 'Reels, shorts, commercials and long-form edits', 'Clapperboard', 3),
    ('AI Video Creation', 'ai-video-creation', 'AI-assisted product and explainer videos', 'Film', 4),
    ('Social Media Management', 'social-media-management', 'Content planning, scheduling and community', 'Share2', 5),
    ('Digital Marketing', 'digital-marketing', 'Meta & Google Ads, lead generation, analytics', 'Megaphone', 6),
    ('Website Design & Development', 'website-design-development', 'Business sites, landing pages, Shopify & WordPress', 'MonitorSmartphone', 7),
    ('Product Advertisement Design', 'product-advertisement-design', 'Ad creatives, product shots and banners', 'ShoppingBag', 8),
    ('Motion Graphics', 'motion-graphics', 'Animated logos, explainers and lower-thirds', 'Sparkles', 9),
    ('AI Image Generation', 'ai-image-generation', 'Generated visuals, product renders and mockups', 'Image', 10)
  on conflict (slug) do nothing
  returning id, slug
)
insert into public.categories (parent_id, name, slug, sort_order)
select p.id, s.name, s.slug, s.ord from parents p
join (values
  ('graphic-design', 'Social Media Design', 'social-media-design', 1),
  ('graphic-design', 'Print Design', 'print-design', 2),
  ('graphic-design', 'Presentation Design', 'presentation-design', 3),
  ('logo-brand-identity', 'Logo Design', 'logo-design', 1),
  ('logo-brand-identity', 'Brand Guidelines', 'brand-guidelines', 2),
  ('video-editing', 'Reels & Shorts', 'reels-shorts', 1),
  ('video-editing', 'Commercial Videos', 'commercial-videos', 2),
  ('video-editing', 'YouTube Editing', 'youtube-editing', 3),
  ('social-media-management', 'Content Planning', 'content-planning', 1),
  ('social-media-management', 'Community Management', 'community-management', 2),
  ('digital-marketing', 'Meta Ads', 'meta-ads', 1),
  ('digital-marketing', 'Google Ads', 'google-ads', 2),
  ('digital-marketing', 'SEO', 'seo', 3),
  ('website-design-development', 'Landing Pages', 'landing-pages', 1),
  ('website-design-development', 'Shopify Stores', 'shopify-stores', 2),
  ('website-design-development', 'WordPress Sites', 'wordpress-sites', 3),
  ('motion-graphics', 'Logo Animation', 'logo-animation', 1),
  ('motion-graphics', 'Explainer Videos', 'explainer-videos', 2)
) as s(parent_slug, name, slug, ord) on s.parent_slug = p.slug
on conflict (slug) do nothing;
