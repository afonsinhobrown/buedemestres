import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPaySuiteChargeByReference } from '@/lib/paysuite';
import { confirmTopupByReference, failTopupByReference } from '@/lib/wallet-topup';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');
    if (!reference) return NextResponse.json({ ok: false, error: 'reference em falta' }, { status: 400 });

    const { rows } = await db.query<{ id: string; status: string; amount: string }>(
      `select id, status, amount from payments where provider_ref = $1 limit 1`,
      [reference]
    );
    const payment = rows[0];
    if (!payment) return NextResponse.json({ ok: true, status: 'none', paid: false, failed: false });

    if (payment.status === 'completed') {
      return NextResponse.json({ ok: true, status: 'completed', paid: true, failed: false, amount: payment.amount });
    }
    if (payment.status === 'failed' || payment.status === 'expired') {
      return NextResponse.json({ ok: true, status: payment.status, paid: false, failed: true });
    }

    const charge = await getPaySuiteChargeByReference(reference);
    if (charge.paid) {
      await confirmTopupByReference(reference);
      return NextResponse.json({ ok: true, status: 'completed', paid: true, failed: false, amount: payment.amount });
    }
    if (charge.failed) {
      await failTopupByReference(reference);
      return NextResponse.json({ ok: true, status: charge.status, paid: false, failed: true });
    }
    return NextResponse.json({ ok: true, status: charge.status || 'pending', paid: false, failed: false });
  } catch (error) {
    console.error('[payments/topup/status]', error);
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
