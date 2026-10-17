import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notify } from '@/lib/pusher';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier: string | undefined = body.jobId || body.requestId;
    const reason: string = String(body.reason || '').trim();
    if (!identifier) {
      return NextResponse.json({ ok: false, error: 'jobId em falta' }, { status: 400 });
    }
    if (reason.length < 10) {
      return NextResponse.json({ ok: false, error: 'descreve o problema com pelo menos 10 caracteres' }, { status: 400 });
    }

    const { rows } = await db.query<{
      id: string;
      request_id: string | null;
      client_id: string;
      provider_id: string;
    }>(
      `select id, request_id, client_id, provider_id
         from jobs
        where id = $1 or request_id = $1
        limit 1`,
      [identifier]
    );
    const job = rows[0];
    if (!job) return NextResponse.json({ ok: false, error: 'trabalho não encontrado' }, { status: 404 });

    const { rows: payRows } = await db.query<{ status: string }>(
      `select status from job_payments where job_id = $1 limit 1`,
      [job.id]
    );
    if (payRows[0]?.status !== 'held') {
      return NextResponse.json({ ok: false, error: 'não há pagamento retido para disputar' }, { status: 409 });
    }

    const ticketNumber = await db.transaction(async (client) => {
      await client.query(
        `update job_payments set status = 'disputed' where job_id = $1 and status = 'held'`,
        [job.id]
      );
      await client.query(
        `update job_addenda set status = 'disputed' where job_id = $1 and status = 'held'`,
        [job.id]
      );
      await client.query(`update jobs set status = 'disputed', updated_at = now() where id = $1`, [job.id]);

      const { rows: ticketRows } = await client.query<{ number: string }>(
        `insert into tickets(
           requester_id, category_id, subject, description, status, priority, channel,
           related_job_id, related_provider_id, related_request_id,
           first_response_due, resolution_due
         )
         select $1, tc.id,
                left('Problema com o serviço: ' || coalesce(r.title, 'Trabalho'), 120),
                $2, 'open', 'high', 'app',
                $3, $4, $5,
                now() + make_interval(mins => tc.first_response_minutes),
                now() + make_interval(mins => tc.resolution_minutes)
           from ticket_categories tc
           left join service_requests r on r.id = $5
          where tc.slug = 'disputa'
         returning number`,
        [job.client_id, reason, job.id, job.provider_id, job.request_id]
      );

      const number = ticketRows[0]?.number ?? null;

      await client.query(
        `insert into notifications(profile_id, type, title, body, data)
         values
           ($1, 'dispute_opened', 'Disputa aberta', 'O cliente reportou um problema com o serviço. O pagamento ficou retido até à resolução.', $3::jsonb),
           ($2, 'dispute_opened', 'Disputa registada', 'A tua disputa foi registada. A equipa de apoio vai analisar o caso.', $3::jsonb)`,
        [job.provider_id, job.client_id, JSON.stringify({ job_id: job.id, ticket: number })]
      );

      await client.query(
        `insert into ticket_events(ticket_id, actor_id, type, meta)
         select t.id, $1, 'created', $2::jsonb
           from tickets t
          where t.number = $3`,
        [job.client_id, JSON.stringify({ job_id: job.id }), number]
      );

      return number;
    });

    try {
      await notify(`job-${job.id}`, 'dispute-opened', { jobId: job.id, ticket: ticketNumber });
    } catch {
      // Pusher é opcional
    }

    return NextResponse.json({ ok: true, ticket: ticketNumber });
  } catch (error) {
    console.error('[payments/dispute]', error);
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
