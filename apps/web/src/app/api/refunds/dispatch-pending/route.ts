import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  createPaySuiteRefund,
  getPaySuitePaymentIdByReference,
  getPaySuiteRefundByPaymentId,
  PaySuiteApiError,
} from '@/lib/paysuite';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RefundRow = {
  id: string;
  job_id: string;
  client_id: string;
  amount: string;
  method: string | null;
  msisdn: string | null;
  payment_id: string | null;
  status: string;
};

type ProcessingRow = { id: string; payment_id: string; status: string };

function webhookUrlFor(origin?: string): string | undefined {
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const base = origin || (/^https:\/\//i.test(site) ? site : '');
  if (!base) return process.env.PAYSUITE_WEBHOOK_URL || undefined;
  return `${base.replace(/\/$/, '')}/api/webhooks/paysuite`;
}

/**
 * Worker de estornos. Chamado pelo pg_cron (x-push-secret). Envia os estornos
 * PaySuite pendentes e reconcilia os que estão em processamento.
 */
export async function POST(req: Request) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: 'worker não configurado' }, { status: 500 });
  if (req.headers.get('x-push-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'não autorizado' }, { status: 401 });
  }

  const origin = new URL(req.url).origin;

  const { rows: pending } = await db.query<RefundRow>(
    `select id, job_id, client_id, amount, method::text as method, msisdn, payment_id, status
       from job_refunds_pending(20)`
  );

  let sent = 0;
  let failed = 0;
  for (const refund of pending) {
    const result = await dispatchRefund(refund, origin);
    if (result === 'sent') sent += 1;
    if (result === 'failed') failed += 1;
  }

  const reconciled = await reconcileProcessingRefunds();

  return NextResponse.json({ ok: true, pending: pending.length, sent, failed, reconciled });
}

async function dispatchRefund(refund: RefundRow, origin: string): Promise<'sent' | 'skipped' | 'failed'> {
  let paymentId = refund.payment_id;

  if (!paymentId) {
    // Resolve o id do pagamento PaySuite pela referência guardada no job_payment.
    const { rows } = await db.query<{ provider_ref: string | null }>(
      `select provider_ref from job_payments where job_id = $1 limit 1`,
      [refund.job_id]
    );
    const reference = rows[0]?.provider_ref;
    if (reference) paymentId = await getPaySuitePaymentIdByReference(reference);
  }

  if (!paymentId) {
    // Não temos como emitir o reembolso externo: devolve à carteira do cliente
    // para o dinheiro não ficar preso. Nada fica pendente.
    await failRefund(refund.id, 'Sem id de pagamento PaySuite — devolvido à carteira');
    return 'failed';
  }

  const claimed = await db.query<{ claim_job_refund: string }>(
    `select claim_job_refund($1, $2)`,
    [refund.id, paymentId]
  );
  if (claimed.rows[0]?.claim_job_refund !== 'processing') return 'skipped';

  try {
    await createPaySuiteRefund({
      paymentId,
      amountMZN: Number(refund.amount),
      reason: 'Estorno de pedido cancelado — Bué de Mestres',
      webhookUrl: webhookUrlFor(origin),
    });
    return 'sent';
  } catch (error) {
    const retriable = error instanceof PaySuiteApiError && error.status >= 500;
    if (retriable) return 'failed';
    const message = error instanceof Error ? error.message : 'Falha ao enviar o estorno';
    console.error('[refunds] dispatch failed', message);
    await failRefund(refund.id, message);
    return 'failed';
  }
}

async function reconcileProcessingRefunds(): Promise<number> {
  const { rows } = await db.query<ProcessingRow>(
    `select id, payment_id, status from job_refunds_processing(20)`
  );
  let changed = 0;
  for (const row of rows) {
    const state = await getPaySuiteRefundByPaymentId(row.payment_id);
    if (state.completed) {
      await db.query(`select complete_job_refund($1)`, [row.id]);
      changed += 1;
    } else if (state.failed) {
      await failRefund(row.id, 'PaySuite reportou falha no estorno');
      changed += 1;
    }
  }
  return changed;
}

async function failRefund(refundId: string, reason: string): Promise<void> {
  await db.query(`select fail_job_refund($1, $2)`, [refundId, reason]);
}
