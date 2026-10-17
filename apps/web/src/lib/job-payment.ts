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
    id: string;
    job_id: string;
    client_id: string;
    provider_id: string;
    amount: string;
    status: string;
  }>(
    `select id, job_id, client_id, provider_id, amount, status
       from job_payments where provider_ref = $1 limit 1`,
    [reference]
  );
  const pay = rows[0];
  if (!pay) return 'not_found';
  if (pay.status === 'held' || pay.status === 'released') return 'already';

  await db.transaction(async (client) => {
    await client.query(
      `update job_payments set status = 'held', held_at = now() where id = $1 and status = 'pending_payment'`,
      [pay.id]
    );
    await client.query(
      `update jobs
          set status = 'price_agreed',
              agreed_amount = coalesce(agreed_amount, $2),
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

type AddendumRow = {
  id: string;
  job_id: string;
  amount: string;
  status: string;
  client_id: string;
  provider_id: string;
};

export async function confirmAddendumByReference(
  reference: string
): Promise<'confirmed' | 'already' | 'not_found'> {
  const { rows } = await db.query<AddendumRow>(
    `select a.id, a.job_id, a.amount, a.status, j.client_id, j.provider_id
       from job_addenda a
       join jobs j on j.id = a.job_id
      where a.provider_ref = $1
      limit 1`,
    [reference]
  );
  const addendum = rows[0];
  if (!addendum) return 'not_found';
  if (addendum.status !== 'pending_payment') return 'already';

  await db.transaction(async (client) => {
    await client.query(
      `update job_addenda set status = 'held', held_at = now() where id = $1 and status = 'pending_payment'`,
      [addendum.id]
    );
    await client.query(
      `insert into notifications(profile_id, type, title, body, data)
       values
         ($1, 'addendum_paid', 'Aditamento pago', $3, $5::jsonb),
         ($2, 'addendum_paid', 'Aditamento confirmado', $4, $5::jsonb)`,
      [
        addendum.provider_id,
        addendum.client_id,
        `O cliente pagou o aditamento de MT ${addendum.amount}. O valor está retido em segurança.`,
        `O teu pagamento do aditamento de MT ${addendum.amount} foi confirmado e está retido em segurança.`,
        JSON.stringify({ job_id: addendum.job_id, addendum_id: addendum.id, reference }),
      ]
    );
  });

  try {
    await notify(`job-${addendum.job_id}`, 'addendum-paid', {
      jobId: addendum.job_id,
      addendumId: addendum.id,
    });
  } catch {
    // Pusher é opcional
  }

  return 'confirmed';
}

export async function failAddendumByReference(
  reference: string
): Promise<'failed' | 'already' | 'not_found'> {
  const { rows } = await db.query<AddendumRow>(
    `select a.id, a.job_id, a.amount, a.status, j.client_id, j.provider_id
       from job_addenda a
       join jobs j on j.id = a.job_id
      where a.provider_ref = $1
      limit 1`,
    [reference]
  );
  const addendum = rows[0];
  if (!addendum) return 'not_found';
  if (addendum.status !== 'pending_payment') return 'already';

  await db.transaction(async (client) => {
    await client.query(
      `update job_addenda set status = 'failed' where id = $1 and status = 'pending_payment'`,
      [addendum.id]
    );
    await client.query(
      `insert into notifications(profile_id, type, title, body, data)
       values
         ($1, 'addendum_failed', 'Aditamento não pago', $3, $5::jsonb),
         ($2, 'addendum_failed', 'Pagamento do aditamento não concluído', $4, $5::jsonb)`,
      [
        addendum.provider_id,
        addendum.client_id,
        `O aditamento de MT ${addendum.amount} não foi pago. O valor não está retido.`,
        `O pagamento do aditamento de MT ${addendum.amount} foi cancelado ou recusado.`,
        JSON.stringify({ job_id: addendum.job_id, addendum_id: addendum.id, reference }),
      ]
    );
  });

  return 'failed';
}
