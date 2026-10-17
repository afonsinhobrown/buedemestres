import { db } from '@/lib/db';

export type SandboxSettings = {
  active: boolean;
  min: number;
  max: number;
};

const DEFAULTS: SandboxSettings = { active: true, min: 1, max: 10 };
const SANDBOX_HARD_MAX = 10;

export async function getSandboxSettings(): Promise<SandboxSettings> {
  try {
    const { rows } = await db.query<{ key: string; value: unknown }>(
      `select key, value from app_settings where key in ('sandbox_mode','sandbox_min_price','sandbox_max_price')`
    );
    const map = new Map(rows.map((row) => [row.key, row.value]));
    const rawActive = map.get('sandbox_mode');
    const active = rawActive === undefined ? DEFAULTS.active : String(rawActive) === 'true';
    const min = Number(map.get('sandbox_min_price') ?? DEFAULTS.min);
    const configuredMax = Number(map.get('sandbox_max_price') ?? DEFAULTS.max);
    const max = active ? Math.min(configuredMax, SANDBOX_HARD_MAX) : configuredMax;
    return {
      active,
      min: Number.isFinite(min) && min > 0 ? min : DEFAULTS.min,
      max: Number.isFinite(max) && max >= min ? max : DEFAULTS.max,
    };
  } catch {
    return DEFAULTS;
  }
}

export function clampSandboxAmount(amount: number, settings: SandboxSettings): number {
  if (!settings.active) return amount;
  return Math.min(settings.max, Math.max(settings.min, amount));
}
