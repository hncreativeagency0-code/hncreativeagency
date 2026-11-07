export type Role = 'client' | 'freelancer' | 'admin';
export type OrderStatus =
  | 'pending_payment' | 'pending_acceptance' | 'active' | 'delivered' | 'revision_requested'
  | 'completed' | 'cancelled' | 'refunded' | 'disputed';
export type PaymentStatus = 'unpaid' | 'awaiting_verification' | 'paid' | 'rejected' | 'refund_pending' | 'refunded';
export type GigStatus = 'draft' | 'pending_review' | 'published' | 'unpublished' | 'rejected';
export type WithdrawalStatus = 'requested' | 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  title: string | null;
  bio: string | null;
  skills: string[];
  years_experience: number | null;
  education: { school: string; degree: string; year?: string }[];
  certifications: { name: string; issuer?: string; year?: string }[];
  languages: string[];
  hourly_rate: number | null;
  country: string | null;
  city: string | null;
  availability: 'available' | 'busy' | 'away';
  is_verified: boolean;
  status: 'active' | 'suspended';
  profile_completed: boolean;
  show_online_status: boolean;
  rating_avg: number;
  rating_count: number;
  completed_orders: number;
  seller_level: SellerLevel;
  founding_until: string | null;
  created_at: string;
}

export type SellerLevel = 'new' | 'rising' | 'top';

export interface Category { id: string; parent_id: string | null; name: string; slug: string; description: string | null; icon: string | null; sort_order: number; is_active: boolean }

export interface GigPackage {
  id: string; gig_id: string; tier: 'basic' | 'standard' | 'premium'; name: string; description: string | null;
  price: number; delivery_days: number; revisions: number; features: string[];
}

export interface Gig {
  id: string; freelancer_id: string; category_id: string | null; subcategory_id: string | null;
  title: string; description: string; tags: string[]; cover_url: string | null; gallery: string[];
  portfolio_ids: string[]; requirements: string | null;
  faqs: { q: string; a: string }[]; extras: { name: string; price: number; days?: number }[];
  status: GigStatus; rejection_reason: string | null; starting_price: number | null; min_delivery_days: number | null;
  rating_avg: number; rating_count: number; orders_completed: number; created_at: string; published_at: string | null;
  freelancer?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'title' | 'is_verified' | 'availability' | 'rating_avg' | 'rating_count'> & Partial<Pick<Profile, 'seller_level' | 'founding_until'>>;
  category?: Pick<Category, 'name' | 'slug'> | null;
  gig_packages?: GigPackage[];
}

export interface PortfolioItem {
  id: string; freelancer_id: string; title: string; description: string | null;
  media: { url: string; type: 'image' | 'video' }[]; link_url: string | null; is_published: boolean; created_at: string;
}

export interface Order {
  id: string; order_number: string; client_id: string; freelancer_id: string; gig_id: string | null; package_id: string | null;
  offer_id: string | null; title: string; package_tier: string | null; requirements: string | null;
  currency: string; price: number; service_fee: number; discount_amount?: number; coupon_id?: string | null; total_amount: number; commission_rate: number;
  commission_amount: number; freelancer_earning: number; delivery_days: number; due_at: string | null;
  status: OrderStatus; payment_status: PaymentStatus; revision_count: number; revision_limit: number;
  accepted_at: string | null; delivered_at: string | null; completed_at: string | null; cancelled_at: string | null;
  cancel_reason: string | null; created_at: string;
  client?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
  freelancer?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
}

export interface FileRef { path: string; name: string; size?: number; mime?: string }

export interface Message {
  id: string; conversation_id: string; sender_id: string | null;
  kind: 'text' | 'image' | 'file' | 'voice' | 'offer' | 'request' | 'system' | 'call';
  body: string | null; reply_to_id: string | null; attachment_path: string | null; attachment_name: string | null;
  attachment_mime: string | null; attachment_size: number | null; duration_seconds: number | null;
  offer_id: string | null; request_id: string | null; call_id: string | null; created_at: string; deleted_at: string | null;
}

export interface ConversationRow {
  conversation_id: string; order_id: string | null; order_number: string | null; last_message_at: string;
  last_message_preview: string | null; other_id: string; other_name: string; other_avatar: string | null;
  other_role: Role; other_last_seen: string | null; i_blocked: boolean; unread_count: number;
}

export interface Notification { id: string; type: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string }

export interface Review {
  id: string; order_id: string; gig_id: string | null; client_id: string; freelancer_id: string; rating: number;
  comment: string | null; response: string | null; response_at: string | null; is_hidden: boolean; created_at: string;
  client?: Pick<Profile, 'full_name' | 'avatar_url'>;
}

export interface JobPost {
  id: string; client_id: string; title: string; description: string; category_id: string | null;
  budget_min: number | null; budget_max: number | null; delivery_days: number | null;
  status: 'open' | 'closed' | 'hired'; proposals_count: number; expires_at: string; created_at: string;
  client?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'city'>;
  category?: Pick<Category, 'name' | 'slug'> | null;
}

export interface JobProposal {
  id: string; job_id: string; freelancer_id: string; cover_letter: string; price: number; delivery_days: number; revisions: number;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn'; order_id: string | null; created_at: string;
  freelancer?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'title' | 'is_verified' | 'rating_avg' | 'rating_count' | 'seller_level' | 'founding_until'>;
  job?: Pick<JobPost, 'id' | 'title' | 'status'>;
}

export interface Coupon {
  id: string; code: string; description: string | null; kind: 'percent' | 'amount'; value: number; max_discount: number | null;
  min_order: number; first_order_only: boolean; owner_id: string | null; max_uses: number | null; used_count: number;
  expires_at: string | null; is_active: boolean; source: 'admin' | 'late_delivery' | 'referral'; created_at: string;
}

export interface Lead {
  id: string; kind: 'consultation' | 'managed_project' | 'agency_package'; name: string; email: string; phone: string | null;
  company: string | null; service: string | null; package: string | null; budget: string | null; preferred_date: string | null;
  preferred_time: string | null; message: string | null; status: 'new' | 'contacted' | 'won' | 'lost'; admin_note: string | null; created_at: string;
}

export interface VerificationRequest {
  id: string; user_id: string; legal_name: string; id_front_path: string; id_back_path: string | null; sample_links: string[];
  notes: string | null; status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string; reviewed_at: string | null;
  user?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'title'>;
}
