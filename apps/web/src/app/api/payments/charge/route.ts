import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildPaymentReference, createPaySuiteCharge, type PaySuiteMethod } from '@/lib/paysuite';
import { clampSandboxAmount, getSandboxSettings } from '@/lib/sandbox';

export const dynamic = 'force-dynamic';

const COMMISSION_RATE = 0.12;

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
    const chargedAmount = clampSandboxAmount(amount, sandbox);

    const reference = buildPaymentReference();
    const charge = await createPaySuiteCharge({
      amountMZN: chargedAmount,
      reference,
      method: mapMethod(method),
      description: `Bué de Mestres — ${reference}`,
      webhookUrl: process.env.PAYSUITE_WEBHOOK_URL || undefined,
    });

    const commission = Number((chargedAmount * COMMISSION_RATE).toFixed(2));
    const payout = Number((chargedAmount - commission).toFixed(2));

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
      [job.id, job.client_id, job.provider_id, chargedAmount, COMMISSION_RATE, commission, payout,
       paymentMethodColumn(method), charge.reference]
    );

    return NextResponse.json({
      ok: true,
      reference: charge.reference,
      chargeId: charge.id,
      checkoutUrl: charge.checkoutUrl ?? null,
      status: charge.status,
      amount: chargedAmount,
      sandbox: sandbox.active,
    });
  } catch (error) {
    console.error('[payments/charge]', error);
    return NextResponse.json({ ok: false, error: 'pagamento indisponível' }, { status: 502 });
  }
}
