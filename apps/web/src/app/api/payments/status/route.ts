import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPaySuiteChargeByReference } from '@/lib/paysuite';
import { confirmJobPaymentByReference } from '@/lib/job-payment';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const identifier = searchParams.get('jobId') || searchParams.get('requestId');
    if (!identifier) return NextResponse.json({ ok: false, error: 'jobId em falta' }, { status: 400 });

    const { rows } = await db.query<{
      job_id: string;
      status: string;
      provider_ref: string | null;
    }>(
      `select jp.job_id, jp.status, jp.provider_ref
         from jobs j
         join job_payments jp on jp.job_id = j.id
        where j.id = $1 or j.request_id = $1
        limit 1`,
      [identifier]
    );
    const pay = rows[0];
    if (!pay) return NextResponse.json({ ok: true, status: 'none', paid: false, failed: false });

    if (pay.status === 'held' || pay.status === 'released') {
      return NextResponse.json({ ok: true, status: 'held', paid: true, failed: false });
    }
    if (!pay.provider_ref) {
      return NextResponse.json({ ok: true, status: 'pending_payment', paid: false, failed: false });
    }

    const charge = await getPaySuiteChargeByReference(pay.provider_ref);
    if (charge.paid) {
      await confirmJobPaymentByReference(pay.provider_ref);
      return NextResponse.json({ ok: true, status: 'held', paid: true, failed: false });
    }
    if (charge.failed) {
      return NextResponse.json({ ok: true, status: charge.status, paid: false, failed: true });
    }
    return NextResponse.json({ ok: true, status: charge.status || 'pending_payment', paid: false, failed: false });
  } catch (error) {
    console.error('[payments/status]', error);
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
