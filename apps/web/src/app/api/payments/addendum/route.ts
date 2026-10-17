import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notify } from '@/lib/pusher';
import { buildPaymentReference } from '@/lib/paysuite';
import { getSandboxSettings } from '@/lib/sandbox';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier: string | undefined = body.jobId || body.requestId;
    const amount = Number(body.amount);
    const description = String(body.description || '').trim();

    if (!identifier) return NextResponse.json({ ok: false, error: 'jobId em falta' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'valor inválido' }, { status: 400 });
    }
    if (description.length < 3) {
      return NextResponse.json({ ok: false, error: 'descreve o trabalho adicional' }, { status: 400 });
    }

    const { rows } = await db.query<{
      id: string;
      client_id: string;
      provider_id: string;
      commission_rate: string | null;
    }>(
      `select j.id, j.client_id, j.provider_id, jp.commission_rate
         from jobs j
         left join job_payments jp on jp.job_id = j.id
        where j.id = $1 or j.request_id = $1
        limit 1`,
      [identifier]
    );
    const job = rows[0];
    if (!job) return NextResponse.json({ ok: false, error: 'trabalho não encontrado' }, { status: 404 });

    const rate = Number(job.commission_rate ?? 0.2);
    const sandbox = await getSandboxSettings();
    if (sandbox.active && (amount < sandbox.min || amount > sandbox.max)) {
      return NextResponse.json(
        { ok: false, error: `No modo sandbox, o aditamento deve estar entre ${sandbox.min} e ${sandbox.max} MT.` },
        { status: 400 }
      );
    }
    const finalAmount = amount;
    const commission = Number((finalAmount * rate).toFixed(2));
    const payout = Number((finalAmount - commission).toFixed(2));
    const reference = buildPaymentReference();

    const { rows: addendumRows } = await db.query<{ id: string }>(
      `insert into job_addenda(
         job_id, amount, commission_rate, commission_amount, provider_payout,
         description, status, provider_ref, created_by
       ) values ($1,$2,$3,$4,$5,$6,'pending_payment',$7,$8)
       returning id`,
      [job.id, finalAmount, rate, commission, payout, description, reference, job.provider_id]
    );
    const addendumId = addendumRows[0].id;

    await db.query(
      `insert into notifications(profile_id, type, title, body, data)
       values ($1, 'addendum_requested', 'O mestre pediu um aditamento', $2, $3::jsonb)`,
      [
        job.client_id,
        `O mestre encontrou trabalho adicional: ${description}. Valor adicional: MT ${finalAmount}.`,
        JSON.stringify({ job_id: job.id, addendum_id: addendumId, amount: finalAmount }),
      ]
    );

    try {
      await notify(`job-${job.id}`, 'addendum-requested', { jobId: job.id, addendumId, amount: finalAmount });
    } catch {
      // Pusher é opcional
    }

    return NextResponse.json({ ok: true, addendumId, amount: finalAmount, reference, sandbox: sandbox.active });
  } catch (error) {
    console.error('[payments/addendum]', error);
    if (error instanceof Error && error.message.includes('job_addenda_active_uq')) {
      return NextResponse.json({ ok: false, error: 'já existe um aditamento em curso' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
