import { supabase } from './supabase';

export type PlatformRates = {
  trialServices: number;
  trialDays: number;
  commissionRate: number;
  trialCommissionRate: number;
  loyaltyClientThreshold: number;
  loyaltyDiscountPct: number;
};

export async function loadPlatformRates(): Promise<PlatformRates> {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', [
      'trial_services',
      'trial_days',
      'commission_rate',
      'trial_commission_rate',
      'loyalty_client_threshold',
      'loyalty_discount_pct',
    ]);
  const map = new Map((data || []).map((row: any) => [row.key, row.value]));
  const num = (key: string, fallback: number) => {
    const value = Number(map.get(key));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    trialServices: num('trial_services', 5),
    trialDays: num('trial_days', 15),
    commissionRate: num('commission_rate', 0.2),
    trialCommissionRate: num('trial_commission_rate', 0),
    loyaltyClientThreshold: num('loyalty_client_threshold', 11),
    loyaltyDiscountPct: num('loyalty_discount_pct', 10),
  };
}
