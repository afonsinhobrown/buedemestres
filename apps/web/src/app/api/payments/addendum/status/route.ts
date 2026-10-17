import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPaySuiteChargeByReference } from '@/lib/paysuite';
import { confirmAddendumByReference, failAddendumByReference } from '@/lib/job-payment';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const addendumId = searchParams.get('addendumId');
    const jobId = searchParams.get('jobId');
    if (!addendumId && !jobId) {
      return NextResponse.json({ ok: false, error: 'addendumId ou jobId em falta' }, { status: 400 });
    }

    const { rows } = await db.query<{
      id: string;
      job_id: string;
      amount: string;
      status: string;
      provider_ref: string | null;
      description: string | null;
    }>(
      addendumId
        ? `select id, job_id, amount, status, provider_ref, description from job_addenda where id = $1 limit 1`
        : `select a.id, a.job_id, a.amount, a.status, a.provider_ref, a.description
             from job_addenda a
             join jobs j on j.id = a.job_id
            where j.id = $1 or j.request_id = $1
            order by a.created_at desc
            limit 1`,
      [addendumId || jobId]
    );
    const addendum = rows[0];
    if (!addendum) {
      return NextResponse.json({ ok: true, status: 'none', paid: false, failed: false, addendum: null });
    }

    if (addendum.status === 'held' || addendum.status === 'released') {
      return NextResponse.json({ ok: true, status: 'held', paid: true, failed: false, addendum });
    }
    if (addendum.status === 'failed') {
      return NextResponse.json({ ok: true, status: 'failed', paid: false, failed: true, addendum });
    }
    if (!addendum.provider_ref) {
      return NextResponse.json({ ok: true, status: 'pending_payment', paid: false, failed: false, addendum });
    }

    const charge = await getPaySuiteChargeByReference(addendum.provider_ref);
    if (charge.paid) {
      await confirmAddendumByReference(addendum.provider_ref);
      return NextResponse.json({ ok: true, status: 'held', paid: true, failed: false, addendum });
    }
    if (charge.failed) {
      await failAddendumByReference(addendum.provider_ref);
      return NextResponse.json({ ok: true, status: charge.status, paid: false, failed: true, addendum });
    }
    return NextResponse.json({
      ok: true,
      status: charge.status || 'pending_payment',
      paid: false,
      failed: false,
      addendum,
    });
  } catch (error) {
    console.error('[payments/addendum/status]', error);
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
