import crypto from 'crypto';

const PAYSUITE_API_URL = (
  process.env.PAYSUITE_API_URL || 'https://paysuite.tech/api/v1'
).replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 15000;
const CODIGO_PAIS = '258';

export const REF_PREFIX = 'BMJOB';

export type PaySuiteMethod = 'mpesa' | 'emola' | 'credit_card';

export type PaySuiteChargeResult = {
  id: string;
  reference: string;
  amount: number;
  status: string | null;
  checkoutUrl?: string;
  method?: string;
};

export class PaySuiteApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PaySuiteApiError';
    this.status = status;
  }
}

const ESTADOS_PAGOS = new Set(['paid', 'pago', 'succeeded', 'success', 'completed', 'confirmed']);
const ESTADOS_FALHADOS = new Set(['failed', 'falhou', 'cancelled', 'canceled', 'expired', 'declined', 'rejected']);

export function classificarEstado(status: string | null | undefined): {
  status: string | null;
  paid: boolean;
  failed: boolean;
} {
  const s = String(status ?? '').toLowerCase();
  return { status: s || null, paid: ESTADOS_PAGOS.has(s), failed: ESTADOS_FALHADOS.has(s) };
}

export function normalizarTelefoneE164(telefone: string | number | null | undefined): string | null {
  let digitos = String(telefone ?? '').replace(/\D/g, '');
  if (digitos.startsWith(CODIGO_PAIS) && digitos.length === 12) digitos = digitos.slice(CODIGO_PAIS.length);
  if (digitos.length !== 9) return null;
  return `+${CODIGO_PAIS}${digitos}`;
}

export function buildPaymentReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${REF_PREFIX}${stamp}${rand}`;
}

function apiToken(): string {
  const token = process.env.PAYSUITE_API_TOKEN;
  if (!token) throw new Error('PAYSUITE_API_TOKEN em falta no ambiente.');
  return token;
}

async function paysuiteRequest<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const response = await fetch(`${PAYSUITE_API_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${apiToken()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      (parsed && typeof parsed.message === 'string' && parsed.message) ||
      (parsed && typeof parsed.error === 'string' && parsed.error) ||
      `PaySuite respondeu com estado ${response.status}`;
    throw new PaySuiteApiError(message, response.status);
  }

  return (parsed?.data ?? parsed ?? {}) as T;
}

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function createPaySuiteCharge(params: {
  amountMZN: number;
  reference: string;
  description?: string;
  method?: PaySuiteMethod;
  contactId?: string | null;
  webhookUrl?: string;
  returnUrl?: string;
}): Promise<PaySuiteChargeResult> {
  const payload: Record<string, unknown> = {
    amount: Number(params.amountMZN.toFixed(2)),
    reference: params.reference.slice(0, 50),
    description: String(params.description || `Pagamento ${params.reference}`).slice(0, 125),
  };
  if (params.method) payload.method = params.method;
  if (params.contactId) payload.contact_id = params.contactId;
  if (params.webhookUrl) payload.webhook_url = params.webhookUrl;
  if (params.returnUrl) payload.return_url = params.returnUrl;

  const charge = await paysuiteRequest<Record<string, unknown>>('/payments', { method: 'POST', body: payload });

  return {
    id: String(charge.id ?? ''),
    reference: String(charge.reference || params.reference),
    amount: toNumber(charge.amount, params.amountMZN),
    status: charge.status ? String(charge.status).toLowerCase() : null,
    method: charge.method ? String(charge.method) : undefined,
    checkoutUrl:
      typeof charge.checkout_url === 'string' && charge.checkout_url ? charge.checkout_url : undefined,
  };
}

/**
 * O GET /payments/:id não expõe o estado. Confirmamos pela lista, filtrando a referência.
 */
export async function getPaySuiteChargeByReference(reference: string): Promise<{
  status: string | null;
  paid: boolean;
  failed: boolean;
  method?: string;
  amount?: number;
}> {
  try {
    const list = await paysuiteRequest<unknown[]>(`/payments?limit=100`, { method: 'GET' });
    const arr = Array.isArray(list) ? list : [];
    const found = arr.find(
      (p) => p && typeof p === 'object' && (p as Record<string, unknown>).reference === reference
    ) as Record<string, unknown> | undefined;
    if (!found) return { status: null, paid: false, failed: false };
    return {
      ...classificarEstado(found.status as string),
      method: found.method ? String(found.method) : undefined,
      amount: found.amount === undefined ? undefined : toNumber(found.amount, 0),
    };
  } catch {
    return { status: null, paid: false, failed: false };
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

function tryHmac(key: string, message: string, provided: string): boolean {
  const hex = crypto.createHmac('sha256', key).update(message, 'utf8').digest('hex');
  const b64 = crypto.createHmac('sha256', key).update(message, 'utf8').digest('base64');
  return safeEqual(provided.toLowerCase(), hex.toLowerCase()) || safeEqual(provided.trim(), b64);
}

export function verifyPaySuiteWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSUITE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const provided = signature
    .replace(/^t=\d+(\.\d+)?\s*[;,]\s*v1=/i, '')
    .replace(/^v1=/i, '')
    .replace(/^sha256=/i, '')
    .replace(/^hmac\s+sha256=/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  if (!provided) return false;
  try {
    if (tryHmac(secret, rawBody, provided)) return true;
    const ts = signature.match(/t=(\d+)/);
    if (ts && tryHmac(secret, `${ts[1]}.${rawBody}`, provided)) return true;
    return false;
  } catch {
    return false;
  }
}

export type PaySuitePayoutMethod = 'mpesa' | 'emola' | 'mkesh' | 'bank' | 'bank_transfer';

export type PaySuitePayoutResult = {
  id: string;
  reference: string;
  amount: number;
  status: string | null;
};

export async function createPaySuitePayout(params: {
  amountMZN: number;
  reference: string;
  description?: string;
  method: PaySuitePayoutMethod;
  beneficiary: { phone?: string; nib?: string; holder: string };
  webhookUrl?: string;
}): Promise<PaySuitePayoutResult> {
  const payload: Record<string, unknown> = {
    amount: Number(params.amountMZN.toFixed(2)),
    currency: 'MZN',
    reference: params.reference.slice(0, 30),
    description: String(params.description || `Pagamento ${params.reference}`).slice(0, 255),
    method: params.method,
    beneficiary: params.beneficiary,
  };
  if (params.webhookUrl) payload.webhook_url = params.webhookUrl;

  const payout = await paysuiteRequest<Record<string, unknown>>('/payouts', { method: 'POST', body: payload });

  return {
    id: String(payout.id ?? ''),
    reference: String(payout.reference || params.reference),
    amount: toNumber(payout.amount, params.amountMZN),
    status: payout.status ? String(payout.status).toLowerCase() : null,
  };
}

export async function getPaySuitePayoutByReference(reference: string): Promise<{
  status: string | null;
  paid: boolean;
  failed: boolean;
}> {
  try {
    const list = await paysuiteRequest<unknown[]>('/payouts?limit=100', { method: 'GET' });
    const arr = Array.isArray(list) ? list : [];
    const found = arr.find(
      (p) => p && typeof p === 'object' && (p as Record<string, unknown>).reference === reference
    ) as Record<string, unknown> | undefined;
    if (!found) return { status: null, paid: false, failed: false };
    const s = String(found.status ?? '').toLowerCase();
    return {
      status: s || null,
      paid: ['completed', 'paid', 'success', 'succeeded'].includes(s),
      failed: ['failed', 'cancelled', 'canceled', 'rejected', 'expired'].includes(s),
    };
  } catch {
    return { status: null, paid: false, failed: false };
  }
}
