import type { PlatformSettings } from './hooks';

/** Client-side mirror of public._order_pricing() for marketing pages and previews.
    The database always recalculates — this is only for display. */
export function estimate(price: number, s: Pick<PlatformSettings, 'client_fee_free_threshold' | 'client_service_fee_rate' | 'commission_rate'> | null) {
  const threshold = s?.client_fee_free_threshold ?? 5000;
  const feeRate = s?.client_service_fee_rate ?? 0.03;
  const com = s?.commission_rate ?? 0.1;
  const fee = price <= threshold ? 0 : Math.round(price * feeRate * 100) / 100;
  const commission = Math.round(price * com * 100) / 100;
  return { fee, clientPays: price + fee, commission, freelancerGets: price - commission, platform: fee + commission };
}

/** Fiverr's published fees, used only in the comparison table (check fiverr.com for current rates). */
export const FIVERR = { sellerRate: 0.2, buyerRate: 0.055, smallOrderFee: 'extra small-order fee', checkedOn: 'October 2026' };

export const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
