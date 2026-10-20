import { db } from '@/lib/db';
import { notify } from '@/lib/pusher';
import { canConfirmPayment, canFailPayment } from '@/lib/job-payment-state';

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
    if (!canFailPayment(pay.status)) return { result: 'already' as const };

    await client.query(
      `update job_payments set status = 'failed' where id = $1 and status = 'pending_payment'`,
      [pay.id]
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
  reference: string,
  paymentId?: string | null
): Promise<'confirmed' | 'already' | 'not_found'> {
  const outcome = await db.transaction(async (client) => {
    const { rows } = await client.query<{
      id: string;
      job_id: string;
      client_id: string;
      provider_id: string;
      amount: string;
      status: string;
    }>(
      `select id, job_id, client_id, provider_id, amount, status
         from job_payments where provider_ref = $1 limit 1 for update`,
      [reference]
    );
    const pay = rows[0];
    if (!pay) return { result: 'not_found' as const };

    if (!canConfirmPayment(pay.status)) {
      return { result: 'already' as const };
    }

    // A PaySuite confirmou um pagamento que já tínhamos como falhado
    // (corrida webhook/polling). Registar a divergência para monitorização.
    if (pay.status === 'failed') {
      console.warn(
        `[payment-divergence] job_payment ${pay.id} estava 'failed' e foi confirmado pela PaySuite (ref ${reference}).`
      );
    }

    const updated = await client.query(
      `update job_payments set status = 'held', held_at = now(),
              provider_payment_id = coalesce($2, provider_payment_id)
        where id = $1 and status in ('pending_payment', 'failed')`,
      [pay.id, paymentId ?? null]
    );
    if (updated.rowCount === 0) return { result: 'already' as const };

    await client.query(
      `update jobs
          set status = 'price_agreed',
              agreed_amount = coalesce(agreed_amount, $2),
              negotiation_state = 'acordado',
              turn_owner = null,
              turn_expires_at = null,
              updated_at = now()
        where id = $1
          and status in ('scheduled', 'requested', 'accepted', 'price_proposed', 'puxado', 'price_agreed')`,
      [pay.job_id, pay.amount]
    );
    await client.query(
      `update service_requests
          set status = 'accepted', budget_max = $2, updated_at = now()
        where id = (select request_id from jobs where id = $1)
          and status in ('open', 'in_negotiation', 'accepted', 'price_proposed', 'puxado')`,
      [pay.job_id, pay.amount]
    );

    return { result: 'confirmed' as const, jobId: pay.job_id };
  });

  if (outcome.result === 'confirmed') {
    try {
      await notify(`job-${outcome.jobId}`, 'payment-held', { jobId: outcome.jobId });
    } catch {
      // Pusher é opcional
    }
  }

  return outcome.result;
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
  });

  return 'failed';
}
