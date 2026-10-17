import { db } from '@/lib/db';

export type PlatformRates = {
  commissionRate: number;
  trialDays: number;
  trialServices: number;
  trialCommissionRate: number;
  loyaltyMasterThreshold: number;
  loyaltyClientThreshold: number;
  loyaltyDiscountPct: number;
};

const DEFAULTS: PlatformRates = {
  commissionRate: 0.2,
  trialDays: 15,
  trialServices: 5,
  trialCommissionRate: 0.1,
  loyaltyMasterThreshold: 10,
  loyaltyClientThreshold: 11,
  loyaltyDiscountPct: 10,
};

export async function getPlatformRates(): Promise<PlatformRates> {
  try {
    const { rows } = await db.query<{ key: string; value: unknown }>(
      `select key, value from app_settings where key in (
         'commission_rate','trial_days','trial_services','trial_commission_rate',
         'loyalty_master_threshold','loyalty_client_threshold','loyalty_discount_pct'
       )`
    );
    const map = new Map(rows.map((row) => [row.key, row.value]));
    const num = (key: string, fallback: number) => {
      const value = Number(map.get(key));
      return Number.isFinite(value) ? value : fallback;
    };
    return {
      commissionRate: num('commission_rate', DEFAULTS.commissionRate),
      trialDays: num('trial_days', DEFAULTS.trialDays),
      trialServices: num('trial_services', DEFAULTS.trialServices),
      trialCommissionRate: num('trial_commission_rate', DEFAULTS.trialCommissionRate),
      loyaltyMasterThreshold: num('loyalty_master_threshold', DEFAULTS.loyaltyMasterThreshold),
      loyaltyClientThreshold: num('loyalty_client_threshold', DEFAULTS.loyaltyClientThreshold),
      loyaltyDiscountPct: num('loyalty_discount_pct', DEFAULTS.loyaltyDiscountPct),
    };
  } catch {
    return DEFAULTS;
  }
}
