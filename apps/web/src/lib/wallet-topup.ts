import { db } from '@/lib/db';

export async function confirmTopupByReference(reference: string): Promise<'confirmed' | 'already' | 'not_found'> {
  const { rows } = await db.query<{ id: string; status: string }>(
    `select id, status from payments where provider_ref = $1 limit 1`,
    [reference]
  );
  const payment = rows[0];
  if (!payment) return 'not_found';
  if (payment.status === 'completed') return 'already';

  await db.query(`select complete_payment($1)`, [payment.id]);
  return 'confirmed';
}

export async function failTopupByReference(reference: string): Promise<'failed' | 'already' | 'not_found'> {
  const { rows } = await db.query<{ id: string; status: string }>(
    `select id, status from payments where provider_ref = $1 limit 1`,
    [reference]
  );
  const payment = rows[0];
  if (!payment) return 'not_found';
  if (payment.status !== 'pending') return 'already';

  await db.query(`update payments set status = 'failed' where id = $1 and status = 'pending'`, [payment.id]);
  return 'failed';
}
