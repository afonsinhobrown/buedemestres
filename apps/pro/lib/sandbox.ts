import { supabase } from './supabase';

export type SandboxSettings = { active: boolean; min: number; max: number };

export async function loadSandboxSettings(): Promise<SandboxSettings> {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['sandbox_mode', 'sandbox_min_price', 'sandbox_max_price']);

  const map = new Map((data || []).map((row: any) => [row.key, row.value]));
  const activeRaw = map.get('sandbox_mode');
  const min = Number(map.get('sandbox_min_price') ?? 11);
  const configuredMax = Number(map.get('sandbox_max_price') ?? 11);
  const max = activeRaw === undefined || String(activeRaw) === 'true' ? Math.min(configuredMax, 11) : configuredMax;
  return {
    active: activeRaw === undefined ? true : String(activeRaw) === 'true',
    min: Number.isFinite(min) && min > 0 ? min : 11,
    max: Number.isFinite(max) && max >= min ? max : 11,
  };
}

export function clampSandboxAmount(amount: number, settings: SandboxSettings): number {
  if (!settings.active) return amount;
  return 11;
}
