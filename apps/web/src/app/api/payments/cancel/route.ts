import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPaySuiteChargeByReference } from '@/lib/paysuite';
import { confirmJobPaymentByReference, failJobPaymentByJobId } from '@/lib/job-payment';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier: string | undefined = body.jobId || body.requestId;
    if (!identifier) {
      return NextResponse.json({ ok: false, error: 'jobId em falta' }, { status: 400 });
    }

    // Nunca marcar como falhado um pagamento que a PaySuite já confirmou.
    const { rows } = await db.query<{ provider_ref: string | null }>(
      `select jp.provider_ref
         from job_payments jp
         join jobs j on j.id = jp.job_id
        where j.id = $1 or j.request_id = $1
        limit 1`,
      [identifier]
    );
    const reference = rows[0]?.provider_ref;
    if (reference) {
      const charge = await getPaySuiteChargeByReference(reference);
      if (charge.paid) {
        await confirmJobPaymentByReference(reference);
        return NextResponse.json({ ok: true, result: 'paid' });
      }
    }

    const result = await failJobPaymentByJobId(identifier);
    return NextResponse.json({ ok: true, result: result.result });
  } catch (error) {
    console.error('[payments/cancel]', error);
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
