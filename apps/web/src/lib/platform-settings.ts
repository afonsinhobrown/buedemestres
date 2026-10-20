import { db } from '@/lib/db';
import {
  DEFAULTS,
  FIELD_BY_KEY,
  SETTING_FIELDS,
  type SettingField,
  type SettingValue,
} from '@/lib/platform-settings-shared';

export {
  DEFAULTS,
  FIELD_BY_KEY,
  SETTING_FIELDS,
  SETTING_GROUPS,
  isSettingField,
  type SettingField,
  type SettingGroup,
  type SettingType,
  type SettingValue,
} from '@/lib/platform-settings-shared';

export async function getSettingsValues(): Promise<Record<string, SettingValue>> {
  const keys = SETTING_FIELDS.map((f) => f.key);
  const { rows } = await db.query<{ key: string; value: unknown }>(
    `select key, value from app_settings where key = any($1::text[])`,
    [keys]
  );
  const stored = new Map(rows.map((r) => [r.key, r.value]));

  const result: Record<string, SettingValue> = {};
  for (const field of SETTING_FIELDS) {
    const raw = stored.has(field.key) ? stored.get(field.key) : DEFAULTS[field.key];
    result[field.key] = normalizeForUi(field, raw);
  }
  return result;
}

function normalizeForUi(field: SettingField, raw: unknown): SettingValue {
  if (field.type === 'boolean') return raw === true || String(raw) === 'true';
  if (field.type === 'text' || field.type === 'select') return String(raw ?? '').replace(/^"|"$/g, '');
  const n = Number(raw);
  const value = Number.isFinite(n) ? n : 0;
  return field.type === 'percent' ? Math.round(value * 100 * 1000) / 1000 : value;
}

function normalizeForStorage(field: SettingField, raw: FormDataEntryValue | null): unknown {
  if (field.type === 'boolean') return raw === 'on' || raw === 'true' || raw === '1';
  if (field.type === 'text' || field.type === 'select') return String(raw ?? '');
  const n = Number(raw);
  let value = Number.isFinite(n) ? n : 0;
  if (field.type === 'percent') value = value / 100;
  if (field.min !== undefined && value < field.min) value = field.min;
  if (field.max !== undefined && value > field.max) value = field.max;
  return value;
}

export async function updateSettings(formData: FormData): Promise<void> {
  const updates: { key: string; value: unknown }[] = [];

  for (const field of SETTING_FIELDS) {
    if (field.type === 'boolean') {
      if (!formData.has(field.key)) continue;
      updates.push({ key: field.key, value: normalizeForStorage(field, formData.get(field.key)) });
      continue;
    }
    if (!formData.has(field.key)) continue;
    updates.push({ key: field.key, value: normalizeForStorage(field, formData.get(field.key)) });
  }

  const hasWithdraw = updates.some((u) => u.key === 'platform_withdraw_pct');
  const hasRetain = updates.some((u) => u.key === 'platform_retain_pct');
  if (hasWithdraw && hasRetain) {
    const withdraw = Number(updates.find((u) => u.key === 'platform_withdraw_pct')?.value ?? 0);
    const retain = Number(updates.find((u) => u.key === 'platform_retain_pct')?.value ?? 0);
    if (Math.abs(withdraw + retain - 1) > 0.0001) {
      throw new Error('As percentagens de saque e retenção dos sócios devem somar 100%.');
    }
  }

  await db.transaction(async (client) => {
    for (const { key, value } of updates) {
      await client.query(
        `insert into app_settings(key, value, updated_at) values ($1, $2::jsonb, now())
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [key, JSON.stringify(value)]
      );
    }
  });
}
