import { db } from '@/lib/db';
import { notify } from '@/lib/pusher';

type PaymentRow = {
  id: string;
  job_id: string;
  provider_id: string;
  amount: string;
  status: string;
};

/**
 * Marca um pagamento como falhado/cancelado. Só desce de 'pending_payment'
 * para 'failed' — nunca toca num pagamento já retido ou libertado.
 * Idempotente: pode ser chamado pelo polling, pelo webhook e pelo cliente.
 */
async function markPaymentFailed(
  findBy: 'reference' | 'job',
  value: string
): Promise<{ result: 'failed' | 'already' | 'not_found'; jobId?: string }> {
  const outcome = await db.transaction(async (client) => {
    const { rows } = await client.query<PaymentRow>(
      findBy === 'reference'
        ? `select id, job_id, provider_id, amount, status
             from job_payments where provider_ref = $1 limit 1 for update`
        : `select jp.id, jp.job_id, jp.provider_id, jp.amount, jp.status
             from job_payments jp
             join jobs j on j.id = jp.job_id
            where j.id = $1 or j.request_id = $1
            limit 1 for update of jp`,
      [value]
    );
    const pay = rows[0];
    if (!pay) return { result: 'not_found' as const };
    if (pay.status !== 'pending_payment') return { result: 'already' as const };

    await client.query(
      `update job_payments set status = 'failed' where id = $1 and status = 'pending_payment'`,
      [pay.id]
    );
    await client.query(
      `insert into notifications(profile_id, type, title, body, data)
       values ($1, 'payment_failed', 'Pagamento não concluído', $2, $3::jsonb)`,
      [
        pay.provider_id,
        `O cliente cancelou ou não concluiu o pagamento de MT ${pay.amount}. Ainda não há valor retido — não inicies a deslocação.`,
        JSON.stringify({ job_id: pay.job_id, value }),
      ]
    );

    return { result: 'failed' as const, jobId: pay.job_id };
  });

  if (outcome.result === 'failed' && outcome.jobId) {
    try {
      await notify(`job-${outcome.jobId}`, 'payment-failed', { jobId: outcome.jobId });
    } catch {
      // Pusher é opcional
    }
  }

  return outcome;
}

export async function failJobPaymentByReference(reference: string) {
  return markPaymentFailed('reference', reference);
}

export async function failJobPaymentByJobId(identifier: string) {
  return markPaymentFailed('job', identifier);
}

/**
 * Marca um pagamento como retido (held) depois de a PaySuite confirmar.
 * Idempotente: pode ser chamado pelo polling e pelo webhook.
 */
export async function confirmJobPaymentByReference(
  reference: string
): Promise<'confirmed' | 'already' | 'not_found'> {
  const { rows } = await db.query<{
    job_id: string;
    client_id: string;
    provider_id: string;
    amount: string;
    status: string;
  }>(
    `select job_id, client_id, provider_id, amount, status
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
       values
         ($1, 'payment_held', 'Pagamento retido!', $3, $5::jsonb),
         ($2, 'payment_confirmed', 'Pagamento confirmado e retido', $4, $5::jsonb)`,
      [
        pay.provider_id,
        pay.client_id,
        `O cliente pagou MT ${pay.amount}. O valor está retido em segurança — já podes iniciar a deslocação.`,
        `O teu pagamento de MT ${pay.amount} foi confirmado e está retido em segurança (Escrow). O mestre já foi notificado.`,
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
