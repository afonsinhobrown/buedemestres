import { db } from '@/lib/db';

/**
 * Catálogo único das taxas e regras financeiras editáveis pelo superadmin.
 * A mesma chave (`app_settings.key`) é lida em runtime pelo resto da plataforma
 * (rates.ts, sandbox.ts, job-payment, escrow 0231, payouts, sócios), por isso a
 * alteração aqui tem efeito imediato sem deploy.
 */

export type SettingType = 'number' | 'percent' | 'boolean' | 'text' | 'select';

export type SettingField = {
  key: string;
  label: string;
  help?: string;
  type: SettingType;
  group: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  unit?: string;
};

export type SettingGroup = {
  id: string;
  title: string;
  description: string;
};

export const SETTING_GROUPS: SettingGroup[] = [
  {
    id: 'comissoes',
    title: 'Comissões da plataforma',
    description: 'Taxa cobrada em cada serviço e regras de período de experiência e fidelidade.',
  },
  {
    id: 'indicacoes',
    title: 'Indicações (referrals)',
    description: 'Desconto atribuído a clientes que trazem novos utilizadores.',
  },
  {
    id: 'multas',
    title: 'Carteira e multas do mestre',
    description:
      'Saldo mínimo exigido ao mestre para operar e valor das multas por abandono. Deixa o saldo mínimo desativado durante a transição.',
  },
  {
    id: 'escrow',
    title: 'Guarda de escrow (inatividade)',
    description:
      'Limites de tempo após os quais um pedido pago é automaticamente estornado (mestre não arrancou) ou enviado para disputa (serviço estagnado).',
  },
  {
    id: 'estornos',
    title: 'Estornos',
    description: 'Destino por omissão do estorno de um pedido cancelado automaticamente.',
  },
  {
    id: 'saques',
    title: 'Saques dos mestres',
    description: 'Aprovação obrigatória antes de enviar o saque para a PaySuite.',
  },
  {
    id: 'socios',
    title: 'Sócios e retenção da plataforma',
    description: 'Divisão da receita da plataforma entre saque dos sócios e retenção. Soma deve ser 100%.',
  },
];

export const SETTING_FIELDS: SettingField[] = [
  // Comissões
  {
    key: 'commission_rate',
    label: 'Comissão normal',
    type: 'percent',
    group: 'comissoes',
    min: 0,
    max: 100,
    step: 0.5,
    unit: '%',
    help: 'Percentagem retida pela plataforma em cada serviço.',
  },
  {
    key: 'trial_commission_rate',
    label: 'Comissão em período de experiência',
    type: 'percent',
    group: 'comissoes',
    min: 0,
    max: 100,
    step: 0.5,
    unit: '%',
  },
  { key: 'trial_days', label: 'Duração da experiência', type: 'number', group: 'comissoes', min: 0, unit: 'dias' },
  { key: 'trial_services', label: 'Serviços em experiência', type: 'number', group: 'comissoes', min: 0 },
  {
    key: 'loyalty_master_threshold',
    label: 'Serviços para fidelidade do mestre',
    type: 'number',
    group: 'comissoes',
    min: 0,
    help: 'A cada N serviços, o mestre passa a pagar a comissão de experiência.',
  },
  { key: 'loyalty_client_threshold', label: 'Serviços para desconto do cliente', type: 'number', group: 'comissoes', min: 0 },
  {
    key: 'loyalty_discount_pct',
    label: 'Desconto de fidelidade do cliente',
    type: 'percent',
    group: 'comissoes',
    min: 0,
    max: 100,
    step: 0.5,
    unit: '%',
  },
  // Indicações
  { key: 'referral_threshold', label: 'Indicações necessárias', type: 'number', group: 'indicacoes', min: 0 },
  {
    key: 'referral_discount_pct',
    label: 'Desconto por indicações',
    type: 'percent',
    group: 'indicacoes',
    min: 0,
    max: 100,
    step: 0.5,
    unit: '%',
  },
  // Multas
  {
    key: 'master_min_balance',
    label: 'Saldo mínimo do mestre',
    type: 'number',
    group: 'multas',
    min: 0,
    unit: 'MT',
    help: 'Saldo que o mestre deve ter na carteira para aceitar serviços.',
  },
  {
    key: 'master_min_balance_enforced',
    label: 'Exigir saldo mínimo',
    type: 'boolean',
    group: 'multas',
    help: 'Desativa para não bloquear mestres já existentes com saldo zero.',
  },
  { key: 'fine_master_abandon', label: 'Multa por abandono', type: 'number', group: 'multas', min: 0, unit: 'MT' },
  {
    key: 'master_min_balance_exempt_domains',
    label: 'Emails de mestres de teste isentos',
    type: 'text',
    group: 'multas',
    help: 'Emails exatos, separados por vírgula. Ex.: mestre@teste.com. Ficam isentos do saldo mínimo. (Não uses domínios — apanham clientes.)',
  },
  {
    key: 'test_master_balance_floor',
    label: 'Saldo garantido aos mestres de teste',
    type: 'number',
    group: 'multas',
    min: 0,
    unit: 'MT',
    help: 'A carteira de um mestre isento nunca fica abaixo deste valor.',
  },
  // Escrow
  {
    key: 'escrow_idle_hours_unstarted',
    label: 'Horas sem arrancar',
    type: 'number',
    group: 'escrow',
    min: 0,
    unit: 'h',
    help: 'Pedido pago sem deslocação além deste tempo é cancelado e estornado.',
  },
  {
    key: 'escrow_idle_hours_in_service',
    label: 'Horas em serviço sem progresso',
    type: 'number',
    group: 'escrow',
    min: 0,
    unit: 'h',
    help: 'Serviço em curso estagnado além deste tempo vai para disputa.',
  },
  // Estornos
  {
    key: 'escrow_default_refund_destination',
    label: 'Destino do estorno automático',
    type: 'select',
    group: 'estornos',
    options: [
      { value: 'wallet', label: 'Carteira da plataforma (imediato)' },
      { value: 'paysuite', label: 'Devolução via PaySuite' },
    ],
  },
  // Saques
  {
    key: 'payout_require_approval',
    label: 'Exigir aprovação dos saques',
    type: 'boolean',
    group: 'saques',
    help: 'Se ativo, os saques ficam pendentes até aprovação da equipa.',
  },
  // Sócios
  {
    key: 'platform_withdraw_pct',
    label: 'Percentagem para saque dos sócios',
    type: 'percent',
    group: 'socios',
    min: 0,
    max: 100,
    step: 0.5,
    unit: '%',
  },
  {
    key: 'platform_retain_pct',
    label: 'Percentagem retida pela plataforma',
    type: 'percent',
    group: 'socios',
    min: 0,
    max: 100,
    step: 0.5,
    unit: '%',
  },
  {
    key: 'platform_withdrawal_approval',
    label: 'Exigir aprovação dos saques dos sócios',
    type: 'boolean',
    group: 'socios',
  },
  // Sandbox
  { key: 'sandbox_mode', label: 'Modo sandbox ativo', type: 'boolean', group: 'sandbox' },
  { key: 'sandbox_min_price', label: 'Preço mínimo', type: 'number', group: 'sandbox', min: 0, unit: 'MT' },
  {
    key: 'sandbox_max_price',
    label: 'Preço máximo',
    type: 'number',
    group: 'sandbox',
    min: 0,
    max: 10,
    unit: 'MT',
  },
];

const FIELD_BY_KEY = new Map(SETTING_FIELDS.map((f) => [f.key, f]));

const DEFAULTS: Record<string, unknown> = {
  commission_rate: 0.2,
  trial_commission_rate: 0.1,
  trial_days: 15,
  trial_services: 5,
  loyalty_master_threshold: 10,
  loyalty_client_threshold: 11,
  loyalty_discount_pct: 10,
  referral_threshold: 10,
  referral_discount_pct: 20,
  master_min_balance: 200,
  master_min_balance_enforced: true,
  fine_master_abandon: 150,
  master_min_balance_exempt_domains: 'mestre@teste.com',
  test_master_balance_floor: 1000,
  escrow_idle_hours_unstarted: 2,
  escrow_idle_hours_in_service: 6,
  escrow_default_refund_destination: 'wallet',
  payout_require_approval: true,
  platform_withdraw_pct: 0.5,
  platform_retain_pct: 0.5,
  platform_withdrawal_approval: true,
  sandbox_mode: true,
  sandbox_min_price: 1,
  sandbox_max_price: 10,
};

/** Valores já normalizados para edição (percentagens em 0–100, como na UI). */
export type SettingValue = number | boolean | string;

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

/** Converte o valor da UI para o que fica guardado em app_settings. */
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

  // Sócios: as duas percentagens têm de somar 100%.
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

export function isSettingField(key: string): boolean {
  return FIELD_BY_KEY.has(key);
}
