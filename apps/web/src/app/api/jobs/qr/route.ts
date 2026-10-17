import { NextResponse } from 'next/server';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const QR_PREFIX = 'BMQR:';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier: string | undefined = body.jobId || body.requestId;
    const phase: string | undefined = body.phase;
    const providerId: string | undefined = body.providerId;

    if (!identifier || !['start', 'finish'].includes(phase || '') || !providerId) {
      return NextResponse.json({ ok: false, error: 'dados em falta' }, { status: 400 });
    }

    const { rows } = await db.query<{ id: string; provider_id: string; status: string }>(
      `select id, provider_id, status from jobs where id = $1 or request_id = $1 limit 1`,
      [identifier]
    );
    const job = rows[0];
    if (!job) return NextResponse.json({ ok: false, error: 'trabalho não encontrado' }, { status: 404 });
    if (job.provider_id !== providerId) {
      return NextResponse.json({ ok: false, error: 'mestre não corresponde ao trabalho' }, { status: 403 });
    }

    await db.query(
      `update job_qr_tokens set used_at = now()
        where job_id = $1 and phase = $2 and used_at is null`,
      [job.id, phase]
    );

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      `insert into job_qr_tokens(job_id, phase, token, provider_id, created_by, expires_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [job.id, phase, token, providerId, providerId, expiresAt.toISOString()]
    );

    const qrDataUrl = await QRCode.toDataURL(`${QR_PREFIX}${token}`, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    return NextResponse.json({
      ok: true,
      token,
      code: token.slice(-6).toUpperCase(),
      qrDataUrl,
      expiresAt: expiresAt.toISOString(),
      phase,
    });
  } catch (error) {
    console.error('[jobs/qr]', error);
    return NextResponse.json({ ok: false, error: 'indisponível' }, { status: 502 });
  }
}
