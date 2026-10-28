import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createPaySuiteCharge, type PaySuiteMethod } from '@/lib/paysuite';

export const dynamic = 'force-dynamic';

function mapMethod(method?: string): PaySuiteMethod | undefined {
  if (method === 'mpesa') return 'mpesa';
  if (method === 'emola') return 'emola';
  if (method === 'card' || method === 'credit_card') return 'credit_card';
  return undefined;
}

function paymentMethodColumn(method?: string): 'mpesa' | 'emola' | 'manual' {
  if (method === 'mpesa') return 'mpesa';
  if (method === 'emola') return 'emola';
  return 'manual';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const addendumId: string | undefined = body.addendumId;
    const method: string | undefined = body.method;
    if (!addendumId) {
      return NextResponse.json({ ok: false, error: 'addendumId em falta' }, { status: 400 });
    }

    const { rows } = await db.query<{
      id: string;
      amount: string;
      status: string;
      provider_ref: string | null;
      checkout_url: string | null;
      description: string | null;
    }>(
      `select id, amount, status, provider_ref, checkout_url, description
         from job_addenda where id = $1 limit 1`,
      [addendumId]
    );
    const addendum = rows[0];
    if (!addendum) return NextResponse.json({ ok: false, error: 'aditamento não encontrado' }, { status: 404 });
    if (addendum.status !== 'pending_payment') {
      return NextResponse.json({ ok: false, error: 'aditamento já não está pendente' }, { status: 409 });
    }
    if (addendum.checkout_url) {
      return NextResponse.json({ ok: true, reference: addendum.provider_ref, checkoutUrl: addendum.checkout_url });
    }
    if (!addendum.provider_ref) {
      return NextResponse.json({ ok: false, error: 'referência em falta' }, { status: 409 });
    }

    const { getSandboxSettings } = await import('@/lib/sandbox');
    const sandbox = await getSandboxSettings();
    const finalAmount = sandbox.active ? 11 : Number(addendum.amount);

    const charge = await createPaySuiteCharge({
      amountMZN: finalAmount,
      reference: addendum.provider_ref,
      method: mapMethod(method),
      description: `Bué de Mestres — aditamento ${addendum.provider_ref}`,
      webhookUrl: process.env.PAYSUITE_WEBHOOK_URL || undefined,
    });

    await db.query(
      `update job_addenda
          set method = $2,
              checkout_url = coalesce($3, checkout_url),
              provider_ref = coalesce($4, provider_ref)
        where id = $1`,
      [addendum.id, paymentMethodColumn(method), charge.checkoutUrl ?? null, charge.reference ?? null]
    );

    return NextResponse.json({
      ok: true,
      reference: charge.reference,
      checkoutUrl: charge.checkoutUrl ?? null,
      status: charge.status,
    });
  } catch (error) {
    console.error('[payments/addendum/charge]', error);
    return NextResponse.json({ ok: false, error: 'pagamento indisponível' }, { status: 502 });
  }
}
