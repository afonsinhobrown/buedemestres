import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier: string | undefined = body.jobId || body.requestId;
    const reason: string = String(body.reason || '').trim();
    if (!identifier) return NextResponse.json({ ok: false, error: 'jobId em falta' }, { status: 400 });
    if (reason.length < 10) return NextResponse.json({ ok: false, error: 'descreve a situação' }, { status: 400 });

    const { rows } = await db.query<{
      id: string;
      request_id: string | null;
      client_id: string;
      provider_id: string;
      company_id: string | null;
    }>(
      `select j.id, j.request_id, j.client_id, j.provider_id, cm.company_id
         from jobs j
         left join company_masters cm on cm.provider_id = j.provider_id
        where j.id = $1 or j.request_id = $1
        limit 1`,
      [identifier]
    );
    const job = rows[0];
    if (!job) return NextResponse.json({ ok: false, error: 'trabalho não encontrado' }, { status: 404 });

    const ticketNumber = await db.transaction(async (client) => {
      await client.query(
        `insert into provider_penalties(provider_id, company_id, job_id, kind, reason)
         values ($1,$2,$3,'identity_mismatch',$4)`,
        [job.provider_id, job.company_id, job.id, reason]
      );

      const { rows: ticketRows } = await client.query<{ number: string }>(
        `insert into tickets(
           requester_id, category_id, subject, description, status, priority, channel,
           related_job_id, related_provider_id, related_request_id,
           first_response_due, resolution_due
         )
         select $1, tc.id, 'Mestre diferente do atribuído', $2, 'open', 'urgent', 'app',
                $3, $4, $5,
                now() + make_interval(mins => tc.first_response_minutes),
                now() + make_interval(mins => tc.resolution_minutes)
           from ticket_categories tc
          where tc.slug = 'disputa'
         returning number`,
        [job.client_id, reason, job.id, job.provider_id, job.request_id]
      );
      const number = ticketRows[0]?.number ?? null;

      await client.query(
        `insert into notifications(profile_id, type, title, body, data)
         values ($1, 'provider_reported', 'Mestre diferente reportado', 'O cliente reportou que o mestre no local não é o atribuído. A equipa vai analisar.', $2::jsonb)`,
        [job.provider_id, JSON.stringify({ job_id: job.id, ticket: number })]
      );

      return number;
    });

    return NextResponse.json({ ok: true, ticket: ticketNumber });
  } catch (error) {
    console.error('[reports/provider]', error);
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
