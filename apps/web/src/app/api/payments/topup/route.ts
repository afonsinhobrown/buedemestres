import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildPaymentReference, createPaySuiteCharge, type PaySuiteMethod } from '@/lib/paysuite';
import { getSandboxSettings } from '@/lib/sandbox';

export const dynamic = 'force-dynamic';

const TOPUP_PREFIX = 'BMTOP';

function buildTopupReference() {
  return `${TOPUP_PREFIX}${buildPaymentReference().replace(/^BMJOB/, '')}`;
}

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
    const profileId: string | undefined = body.profileId;
    const amount = Number(body.amount);
    const method: string | undefined = body.method;

    const sandbox = await getSandboxSettings().catch(() => ({ active: false, min: 11, max: 11 }));
    const minTopup = sandbox.active ? 11 : 50;

    if (!profileId) return NextResponse.json({ ok: false, error: 'profileId em falta' }, { status: 400 });
    if (!Number.isFinite(amount) || amount < minTopup) {
      return NextResponse.json({ ok: false, error: `o carregamento mínimo é MT ${minTopup}` }, { status: 400 });
    }

    const { rows } = await db.query<{ id: string }>(`select id from profiles where id = $1 limit 1`, [profileId]);
    if (!rows[0]) return NextResponse.json({ ok: false, error: 'perfil não encontrado' }, { status: 404 });

    const chargedAmount = sandbox.active ? 11 : amount;
    const reference = buildTopupReference();
    const charge = await createPaySuiteCharge({
      amountMZN: chargedAmount,
      reference,
      method: mapMethod(method),
      description: `Bué de Mestres — carregamento ${reference}`,
      webhookUrl: process.env.PAYSUITE_WEBHOOK_URL || undefined,
    });

    await db.query(
      `insert into payments(profile_id, amount, method, status, provider_ref)
       values ($1,$2,$3,'pending',$4)`,
      [profileId, chargedAmount, paymentMethodColumn(method), charge.reference]
    );

    return NextResponse.json({
      ok: true,
      reference: charge.reference,
      checkoutUrl: charge.checkoutUrl ?? null,
    });
  } catch (error) {
    console.error('[payments/topup]', error);
    return NextResponse.json({ ok: false, error: 'carregamento indisponível' }, { status: 502 });
  }
}
