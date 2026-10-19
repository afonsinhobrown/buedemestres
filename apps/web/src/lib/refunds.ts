import { db } from '@/lib/db';

/**
 * Confirma um estorno PaySuite a partir do webhook (refund.success).
 * Faz correspondência pelo payment_id do pagamento original.
 */
export async function confirmRefundByPaymentId(paymentId: string): Promise<'confirmed' | 'already' | 'not_found'> {
  if (!paymentId) return 'not_found';
  const { rows } = await db.query<{ id: string; status: string }>(
    `select id, status from job_refunds
      where destination = 'paysuite' and payment_id = $1
      order by created_at desc limit 1`,
    [paymentId]
  );
  const refund = rows[0];
  if (!refund) return 'not_found';
  if (refund.status === 'completed') return 'already';

  await db.query(`select complete_job_refund($1)`, [refund.id]);
  return 'confirmed';
}

/**
 * Marca um estorno PaySuite como falhado (refund.failed). O 0232 devolve o valor
 * à carteira do cliente para o dinheiro não ficar preso.
 */
export async function failRefundByPaymentId(
  paymentId: string,
  reason?: string
): Promise<'failed' | 'already' | 'not_found'> {
  if (!paymentId) return 'not_found';
  const { rows } = await db.query<{ id: string; status: string }>(
    `select id, status from job_refunds
      where destination = 'paysuite' and payment_id = $1
      order by created_at desc limit 1`,
    [paymentId]
  );
  const refund = rows[0];
  if (!refund) return 'not_found';
  if (refund.status === 'completed' || refund.status === 'failed') return 'already';

  await db.query(`select fail_job_refund($1, $2)`, [
    refund.id,
    reason ?? 'PaySuite reportou falha no estorno',
  ]);
  return 'failed';
}
