import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const identifier = searchParams.get('jobId');
    if (!identifier) return NextResponse.json({ ok: false, error: 'jobId em falta' }, { status: 400 });

    const { rows } = await db.query<{ id: string }>(
      `select id from jobs where id = $1 or request_id = $1 limit 1`,
      [identifier]
    );
    const job = rows[0];
    if (!job) return NextResponse.json({ ok: false, error: 'trabalho não encontrado' }, { status: 404 });

    const { rows: tokens } = await db.query<{ phase: string }>(
      `select distinct on (phase) phase
         from job_qr_tokens
        where job_id = $1 and used_at is null and expires_at > now()
        order by phase, created_at desc`,
      [job.id]
    );
    const phases = new Set(tokens.map((row) => row.phase));
    return NextResponse.json({
      ok: true,
      startReady: phases.has('start'),
      finishReady: phases.has('finish'),
    });
  } catch (error) {
    console.error('[jobs/qr/status]', error);
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
