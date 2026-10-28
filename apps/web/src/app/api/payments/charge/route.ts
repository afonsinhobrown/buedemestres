import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildPaymentReference, createPaySuiteCharge, type PaySuiteMethod } from '@/lib/paysuite';
import { getSandboxSettings } from '@/lib/sandbox';
import { getPlatformRates } from '@/lib/rates';

export const dynamic = 'force-dynamic';

function mapMethod(method?: string): PaySuiteMethod | undefined {
  if (method === 'mpesa') return 'mpesa';
  if (method === 'emola') return 'emola';
  if (method === 'card' || method === 'credit_card') return 'credit_card';
  return undefined;
}

function paymentMethodColumn(method?: string): string {
  if (method === 'mpesa') return 'mpesa';
  if (method === 'emola') return 'emola';
  if (method === 'card' || method === 'credit_card') return 'manual';
  return 'manual';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier: string | undefined = body.jobId || body.requestId;
    const amount = Number(body.amount);
    const method: string | undefined = body.method;

    if (!identifier) return NextResponse.json({ ok: false, error: 'jobId em falta' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'valor inválido' }, { status: 400 });
    }

    const { rows: jobRows } = await db.query<{
      id: string;
      client_id: string;
      provider_id: string;
    }>(
      `select id, client_id, provider_id
         from jobs
        where id = $1 or request_id = $1
        limit 1`,
      [identifier]
    );
    const job = jobRows[0];
    if (!job) return NextResponse.json({ ok: false, error: 'trabalho não encontrado' }, { status: 404 });

    const sandbox = await getSandboxSettings();
    const rates = await getPlatformRates();

    if (sandbox.active && amount !== 11 && (amount < sandbox.min || amount > sandbox.max)) {
      return NextResponse.json(
        { ok: false, error: `No modo sandbox, o valor fixo do serviço é de MT 11.` },
        { status: 400 }
      );
    }
    const contractAmount = sandbox.active ? 11 : amount;

    const [{ rows: providerRows }, { rows: providerCompleted }, { rows: clientCompleted }] = await Promise.all([
      db.query<{ trial_ends_at: string | null }>(
        `select trial_ends_at from provider_profiles where profile_id = $1 limit 1`,
        [job.provider_id]
      ),
      db.query<{ count: string }>(
        `select count(*)::text as count from jobs where provider_id = $1 and status = 'completed'`,
        [job.provider_id]
      ),
      db.query<{ count: string }>(
        `select count(*)::text as count from jobs where client_id = $1 and status = 'completed'`,
        [job.client_id]
      ),
    ]);

    const trialActive = Boolean(
      providerRows[0]?.trial_ends_at && new Date(providerRows[0].trial_ends_at).getTime() > Date.now()
    );
    const providerCount = Number(providerCompleted[0]?.count || 0);
    const clientCount = Number(clientCompleted[0]?.count || 0);

    const trialEligible = trialActive && providerCount < rates.trialServices;
    const commissionRate = trialEligible ? rates.trialCommissionRate : rates.commissionRate;

    const nextClientService = clientCount + 1;
    const clientDiscount =
      rates.loyaltyClientThreshold > 0 &&
      (nextClientService === rates.loyaltyClientThreshold ||
        (nextClientService > rates.loyaltyClientThreshold &&
          (nextClientService - rates.loyaltyClientThreshold) % 10 === 0))
        ? rates.loyaltyDiscountPct / 100
        : 0;

    const chargedAmount = sandbox.active ? 11 : Number((contractAmount * (1 - clientDiscount)).toFixed(2));
    const commission = Number((chargedAmount * commissionRate).toFixed(2));
    const payout = Number((chargedAmount - commission).toFixed(2));
    const storedCommissionRate = chargedAmount > 0 ? commission / chargedAmount : 0;

    const reference = buildPaymentReference();
    // O webhook tem de apontar para a instância que criou o pagamento.
    // O valor fixo em PAYSUITE_WEBHOOK_URL pode estar desactualizado (ex.:
    // aponta para um antigo deploy) e as confirmações perdem-se.
    const origin = new URL(req.url).origin;
    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    const publicOrigin = isLocalOrigin
      ? String(process.env.NEXT_PUBLIC_SITE_URL || process.env.PAYSUITE_WEBHOOK_URL || origin)
          .replace(/\/api\/webhooks\/paysuite$/, '')
          .replace(/\/$/, '')
      : origin;
    const webhookUrl = isLocalOrigin
      ? process.env.PAYSUITE_WEBHOOK_URL || undefined
      : `${origin}/api/webhooks/paysuite`;
    const returnUrl = `${publicOrigin}/apps/cliente`;

    const charge = await createPaySuiteCharge({
      amountMZN: chargedAmount,
      reference,
      method: mapMethod(method),
      description: `Bué de Mestres — ${reference}`,
      webhookUrl,
      returnUrl,
    });

    await db.query(
      `update jobs
          set agreed_amount = $2,
              price_proposed = $2,
              status = case when status = 'cancelled' then 'price_proposed' else status end,
              cancel_reason = null,
              turn_expires_at = now() + interval '30 minutes',
              negotiation_state = 'pagamento_em_curso',
              updated_at = now()
        where id = $1`,
      [job.id, contractAmount]
    );

    await db.query(
      `insert into job_payments
         (job_id, client_id, provider_id, amount, commission_rate, commission_amount,
          provider_payout, method, status, provider_ref)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'pending_payment',$9)
       on conflict (job_id) do update set
         amount = excluded.amount,
         commission_rate = excluded.commission_rate,
         commission_amount = excluded.commission_amount,
         provider_payout = excluded.provider_payout,
         method = excluded.method,
         status = 'pending_payment',
         provider_ref = excluded.provider_ref`,
      [job.id, job.client_id, job.provider_id, chargedAmount, storedCommissionRate, commission, payout,
       paymentMethodColumn(method), charge.reference]
    );

    return NextResponse.json({
      ok: true,
      reference: charge.reference,
      chargeId: charge.id,
      checkoutUrl: charge.checkoutUrl ?? null,
      status: charge.status,
      amount: chargedAmount,
      originalAmount: contractAmount,
      discount: Number((contractAmount - chargedAmount).toFixed(2)),
      commissionRate,
      trial: trialEligible,
      sandbox: sandbox.active,
    });
  } catch (error) {
    console.error('[payments/charge]', error);
    return NextResponse.json({ ok: false, error: 'pagamento indisponível' }, { status: 502 });
  }
}
