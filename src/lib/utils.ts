import type { OrderStatus, PaymentStatus, WithdrawalStatus } from './types';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export const money = (n: number | string | null | undefined, currency = 'PKR') =>
  `${currency} ${Number(n ?? 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

export const date = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const time = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function timeAgo(d: string | null | undefined): string {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return date(d);
}

export function timeLeft(due: string | null): { label: string; late: boolean } {
  if (!due) return { label: '—', late: false };
  const ms = new Date(due).getTime() - Date.now();
  const late = ms < 0;
  const h = Math.floor(Math.abs(ms) / 3_600_000);
  const label = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((Math.abs(ms) % 3_600_000) / 60000)}m`;
  return { label: late ? `${label} late` : `${label} left`, late };
}

export const duration = (sec: number | null | undefined) => {
  const s = Math.max(0, Math.round(sec ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const fileSize = (b: number | null | undefined) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

export const initials = (name: string | null | undefined) =>
  (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: 'Pending payment', tone: 'amber' },
  pending_acceptance: { label: 'Pending acceptance', tone: 'amber' },
  active: { label: 'Active', tone: 'brand' },
  delivered: { label: 'Delivered', tone: 'sky' },
  revision_requested: { label: 'Revision requested', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
  refunded: { label: 'Refunded', tone: 'slate' },
  disputed: { label: 'Disputed', tone: 'red' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: 'Unpaid', tone: 'slate' },
  awaiting_verification: { label: 'Awaiting verification', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  refund_pending: { label: 'Refund pending', tone: 'amber' },
  refunded: { label: 'Refunded', tone: 'slate' },
};

export const WITHDRAWAL_STATUS: Record<WithdrawalStatus, { label: string; tone: Tone }> = {
  requested: { label: 'Requested', tone: 'amber' },
  under_review: { label: 'Under review', tone: 'amber' },
  approved: { label: 'Approved', tone: 'brand' },
  processing: { label: 'Processing', tone: 'sky' },
  paid: { label: 'Paid', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};

export type Tone = 'brand' | 'green' | 'amber' | 'red' | 'sky' | 'slate';

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
