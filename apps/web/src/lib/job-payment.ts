import { db } from '@/lib/db';
import { notify } from '@/lib/pusher';

/**
 * Marca um pagamento como retido (held) depois de a PaySuite confirmar.
 * Idempotente: pode ser chamado pelo polling e pelo webhook.
 */
export async function confirmJobPaymentByReference(
  reference: string
): Promise<'confirmed' | 'already' | 'not_found'> {
  const { rows } = await db.query<{
    job_id: string;
    provider_id: string;
    amount: string;
    status: string;
  }>(
    `select job_id, provider_id, amount, status
       from job_payments where provider_ref = $1 limit 1`,
    [reference]
  );
  const pay = rows[0];
  if (!pay) return 'not_found';
  if (pay.status === 'held' || pay.status === 'released') return 'already';

  await db.transaction(async (client) => {
    await client.query(
      `update job_payments set status = 'held', held_at = now() where job_id = $1`,
      [pay.job_id]
    );
    await client.query(
      `update jobs
          set status = 'price_agreed',
              agreed_amount = $2,
              negotiation_state = 'acordado',
              turn_owner = null,
              turn_expires_at = null,
              updated_at = now()
        where id = $1`,
      [pay.job_id, pay.amount]
    );
    await client.query(
      `update service_requests
          set status = 'accepted', budget_max = $2, updated_at = now()
        where id = (select request_id from jobs where id = $1)`,
      [pay.job_id, pay.amount]
    );
    await client.query(
      `insert into notifications(profile_id, type, title, body, data)
       values ($1, 'payment_held', 'Pagamento retido!', $2, $3::jsonb)`,
      [
        pay.provider_id,
        `O cliente pagou MT ${pay.amount}. O valor está retido em segurança — já podes iniciar a deslocação.`,
        JSON.stringify({ job_id: pay.job_id, reference }),
      ]
    );
  });

  try {
    await notify(`job-${pay.job_id}`, 'payment-held', { jobId: pay.job_id });
  } catch {
    // Pusher é opcional
  }

  return 'confirmed';
}
