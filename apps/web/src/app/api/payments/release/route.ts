import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notify } from '@/lib/pusher';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier: string | undefined = body.jobId || body.requestId;
    if (!identifier) {
      return NextResponse.json({ ok: false, error: 'jobId em falta' }, { status: 400 });
    }

    const { rows } = await db.query<{
      id: string;
      request_id: string | null;
      client_id: string;
      provider_id: string;
      status: string;
      amount: string | null;
    }>(
      `select j.id, j.request_id, j.client_id, j.provider_id, j.status, jp.amount
         from jobs j
         left join job_payments jp on jp.job_id = j.id
        where j.id = $1 or j.request_id = $1
        limit 1`,
      [identifier]
    );
    const job = rows[0];
    if (!job) return NextResponse.json({ ok: false, error: 'trabalho não encontrado' }, { status: 404 });

    const { rows: payRows } = await db.query<{ status: string }>(
      `select status from job_payments where job_id = $1 limit 1`,
      [job.id]
    );
    const payment = payRows[0];
    if (!payment) return NextResponse.json({ ok: false, error: 'pagamento não encontrado' }, { status: 404 });
    if (payment.status === 'released') {
      return NextResponse.json({ ok: true, result: 'already' });
    }
    if (job.status !== 'awaiting_confirmation') {
      return NextResponse.json(
        { ok: false, error: 'o mestre ainda não marcou o serviço como terminado' },
        { status: 409 }
      );
    }
    if (payment.status !== 'held') {
      return NextResponse.json({ ok: false, error: 'pagamento não está retido' }, { status: 409 });
    }

    await db.transaction(async (client) => {
      await client.query(
        `insert into wallets(profile_id) values ($1) on conflict (profile_id) do nothing`,
        [job.provider_id]
      );
      await client.query(`select release_job_payment($1)`, [job.id]);
      if (job.request_id) {
        await client.query(
          `update service_requests set status = 'completed', updated_at = now() where id = $1`,
          [job.request_id]
        );
      }
      await client.query(
        `insert into notifications(profile_id, type, title, body, data)
         values
           ($1, 'payment_released', 'Pagamento libertado', 'O cliente confirmou a conclusão. O valor foi libertado para a tua carteira.', $3::jsonb),
           ($2, 'payment_released', 'Serviço concluído', 'Confirmaste a conclusão do serviço. O pagamento foi libertado ao mestre.', $3::jsonb)`,
        [job.provider_id, job.client_id, JSON.stringify({ job_id: job.id })]
      );
    });

    try {
      await notify(`job-${job.id}`, 'payment-released', { jobId: job.id });
    } catch {
      // Pusher é opcional
    }

    return NextResponse.json({ ok: true, result: 'released' });
  } catch (error) {
    console.error('[payments/release]', error);
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
