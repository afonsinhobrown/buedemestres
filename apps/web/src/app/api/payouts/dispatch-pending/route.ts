import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dispatchPayout, reconcileProcessingPayouts } from '@/lib/payouts';
import { reconcileProcessingPartnerPayouts } from '@/lib/platform-withdrawals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Worker de saques. Chamado automaticamente pelo pg_cron (x-push-secret).
 * Envia todos os pedidos pendentes e reconcilia os que estão em processamento.
 */
export async function POST(req: Request) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: 'worker não configurado' }, { status: 500 });
  if (req.headers.get('x-push-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'não autorizado' }, { status: 401 });
  }

  const origin = new URL(req.url).origin;
  const { rows: cfg } = await db.query<{ value: unknown }>(
    `select value from app_settings where key = 'payout_require_approval' limit 1`
  );
  const requireApproval = cfg[0]?.value === true || String(cfg[0]?.value) === 'true';

  const pending = requireApproval
    ? { rows: [] as { id: string }[] }
    : await db.query<{ id: string }>(
        `select id from payouts where status = 'pending' order by created_at asc limit 20`
      );
  const rows = pending.rows;

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await dispatchPayout(row.id, origin);
    if (result === 'sent') sent += 1;
    if (result === 'failed') failed += 1;
  }

  const reconciled = await reconcileProcessingPayouts();
  const partnerReconciled = await reconcileProcessingPartnerPayouts();

  return NextResponse.json({
    ok: true,
    approvalRequired: requireApproval,
    pending: rows.length,
    sent,
    failed,
    reconciled,
    partnerReconciled,
  });
}
