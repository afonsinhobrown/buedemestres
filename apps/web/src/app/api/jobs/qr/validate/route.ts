import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notify } from '@/lib/pusher';

export const dynamic = 'force-dynamic';

const QR_PREFIX = 'BMQR:';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawToken: string = String(body.token || '');
    let token = rawToken.startsWith(QR_PREFIX) ? rawToken.slice(QR_PREFIX.length) : rawToken;
    const manualCode = String(body.code || '').toUpperCase();
    const jobIdentifier: string | undefined = body.jobId || body.requestId;
    const clientId: string | undefined = body.clientId;
    const phase: string | undefined = body.phase;

    if ((!token && !manualCode) || !clientId || !['start', 'finish'].includes(phase || '')) {
      return NextResponse.json({ ok: false, error: 'dados em falta' }, { status: 400 });
    }

    if (!token && manualCode && jobIdentifier) {
      const { rows: codeRows } = await db.query<{ token: string }>(
        `select t.token
           from job_qr_tokens t
           join jobs j on j.id = t.job_id
          where (j.id = $1 or j.request_id = $1)
            and t.phase = $2
            and lower(right(t.token, 6)) = lower($3)
            and t.used_at is null
            and t.expires_at > now()
          order by t.created_at desc
          limit 1`,
        [jobIdentifier, phase, manualCode]
      );
      token = codeRows[0]?.token || '';
    }

    const { rows } = await db.query<{
      id: string;
      job_id: string;
      phase: string;
      provider_id: string;
      expires_at: string;
      used_at: string | null;
      job_provider_id: string;
      job_client_id: string;
      job_status: string;
      request_id: string | null;
    }>(
      `select t.id, t.job_id, t.phase, t.provider_id, t.expires_at, t.used_at,
              j.provider_id as job_provider_id, j.client_id as job_client_id,
              j.status as job_status, j.request_id
         from job_qr_tokens t
         join jobs j on j.id = t.job_id
        where t.token = $1
        limit 1`,
      [token]
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ ok: false, error: 'QR inválido' }, { status: 404 });
    if (row.job_client_id !== clientId) {
      return NextResponse.json({ ok: false, error: 'este QR não pertence ao teu pedido' }, { status: 403 });
    }
    if (row.used_at) return NextResponse.json({ ok: false, error: 'QR já utilizado' }, { status: 409 });
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: 'QR expirado' }, { status: 409 });
    }
    if (row.phase !== phase) return NextResponse.json({ ok: false, error: 'fase do QR incorreta' }, { status: 409 });
    if (row.provider_id !== row.job_provider_id) {
      return NextResponse.json(
        { ok: false, error: 'mestre diferente do atribuído. Reporta a situação.' },
        { status: 409 }
      );
    }

    const nextStatus = phase === 'start' ? 'in_service' : 'awaiting_confirmation';
    if (phase === 'start' && !['arrived', 'price_agreed'].includes(row.job_status)) {
      return NextResponse.json({ ok: false, error: 'o serviço ainda não pode ser iniciado' }, { status: 409 });
    }
    if (phase === 'finish' && row.job_status !== 'in_service') {
      return NextResponse.json({ ok: false, error: 'o serviço ainda não está em execução' }, { status: 409 });
    }

    await db.transaction(async (client) => {
      await client.query(
        `update job_qr_tokens set used_at = now() where id = $1 and used_at is null`,
        [row.id]
      );
      await client.query(
        `update jobs
            set status = $2::job_status,
                ${phase === 'start' ? 'started_at = now(),' : ''}
                updated_at = now()
          where id = $1`,
        [row.job_id, nextStatus]
      );
      if (row.request_id) {
        await client.query(
          `update service_requests set status = 'in_progress', updated_at = now() where id = $1`,
          [row.request_id]
        );
      }
      await client.query(
        `insert into notifications(profile_id, type, title, body, data)
         values
           ($1, $3, $4, $5, $7::jsonb),
           ($2, $3, $4, $6, $7::jsonb)`,
        [
          row.job_provider_id,
          row.job_client_id,
          `qr_${phase}`,
          phase === 'start' ? 'Serviço iniciado por QR' : 'Serviço finalizado por QR',
          phase === 'start'
            ? 'O cliente validou o QR de início. O serviço está oficialmente em execução.'
            : 'O cliente validou o QR de conclusão. Confirma a conclusão para libertar o pagamento.',
          phase === 'start'
            ? 'Validaste o QR de início. O serviço está em execução.'
            : 'Validaste o QR de conclusão. Confirma a conclusão para libertar o pagamento.',
          JSON.stringify({ job_id: row.job_id, phase }),
        ]
      );
    });

    try {
      await notify(`job-${row.job_id}`, `qr-${phase}`, { jobId: row.job_id, phase });
    } catch {
      // Pusher é opcional
    }

    return NextResponse.json({ ok: true, jobStatus: nextStatus, phase });
  } catch (error) {
    console.error('[jobs/qr/validate]', error);
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
