import { db } from '@/lib/db';
import { createPaySuitePayout, getPaySuitePayoutByReference, type PaySuitePayoutMethod } from '@/lib/paysuite';

type PayoutRow = {
  id: string;
  provider_id: string;
  amount: string;
  method: string;
  msisdn: string | null;
  status: string;
  provider_ref: string | null;
  account_name: string | null;
  bank_name: string | null;
  account_number: string | null;
};

function digits(value: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

function telefoneLocal(value: string | null): string | null {
  let d = digits(value);
  if (d.startsWith('258') && d.length === 12) d = d.slice(3);
  return d.length === 9 ? d : null;
}

function webhookUrlFor(origin?: string): string | undefined {
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const base = origin || (/^https:\/\//i.test(site) ? site : '');
  if (!base) return process.env.PAYSUITE_WEBHOOK_URL || undefined;
  return `${base.replace(/\/$/, '')}/api/webhooks/paysuite`;
}

export type DispatchResult = 'sent' | 'skipped' | 'failed';

/**
 * Envia um pedido de saque para a PaySuite. Idempotente: só processa payouts
 * em `pending`; uma segunda chamada devolve skipped.
 */
export async function dispatchPayout(payoutId: string, origin?: string): Promise<DispatchResult> {
  const { rows } = await db.query<PayoutRow>(
    `select id, provider_id, amount, method, msisdn, status, provider_ref,
            account_name, bank_name, account_number
       from payouts where id = $1 limit 1`,
    [payoutId]
  );
  const payout = rows[0];
  if (!payout || payout.status !== 'pending') return 'skipped';

  let method: PaySuitePayoutMethod;
  let beneficiary: { phone?: string; nib?: string; holder: string };

  if (payout.method === 'mpesa' || payout.method === 'emola') {
    const phone = telefoneLocal(payout.msisdn);
    if (!phone) {
      await markPayoutFailed(payout, 'Número de telemóvel inválido');
      return 'failed';
    }
    method = payout.method;
    beneficiary = { phone, holder: payout.account_name || 'Mestre' };
  } else if (payout.method === 'bank_transfer') {
    const nib = digits(payout.account_number);
    if (nib.length !== 21) {
      await markPayoutFailed(payout, 'NIB inválido');
      return 'failed';
    }
    method = 'bank';
    beneficiary = { nib, holder: payout.account_name || 'Mestre' };
  } else {
    await markPayoutFailed(payout, 'Método de pagamento não suportado');
    return 'failed';
  }

  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const reference = `BMPAY${stamp}${rand}`.slice(0, 30);

  const claim = await db.query(
    `update payouts set status = 'processing', provider_ref = $2
      where id = $1 and status = 'pending' returning id`,
    [payout.id, reference]
  );
  if (claim.rowCount === 0) return 'skipped';

  try {
    await createPaySuitePayout({
      amountMZN: Number(payout.amount),
      reference,
      method,
      beneficiary,
      description: `Saque Bué de Mestres — ${payout.id}`,
      webhookUrl: webhookUrlFor(origin),
    });
    return 'sent';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao enviar o pagamento';
    console.error('[payouts] dispatch failed', message);
    await failPayoutByReference(reference, message);
    return 'failed';
  }
}

async function markPayoutFailed(payout: PayoutRow, reason: string) {
  await db.transaction(async (client) => {
    await client.query(
      `update payouts set status = 'failed', failure_reason = $2
        where id = $1 and status = 'pending'`,
      [payout.id, reason]
    );
    await client.query(
      `select wallet_apply($1, 'refund', $2, 'Saque falhado — valor devolvido', null, $3::jsonb)`,
      [payout.provider_id, payout.amount, JSON.stringify({ payout_id: payout.id })]
    );
    await client.query(
      `insert into notifications(profile_id, type, title, body, data)
       values ($1, 'payout_failed', 'Pagamento não enviado', $2, $3::jsonb)`,
      [
        payout.provider_id,
        `O saque de MT ${payout.amount} falhou. O valor foi devolvido à tua carteira.`,
        JSON.stringify({ payout_id: payout.id }),
      ]
    );
  });
}

export async function confirmPayoutByReference(reference: string): Promise<'confirmed' | 'already' | 'not_found'> {
  const { rows } = await db.query<PayoutRow>(
    `select id, provider_id, amount, status from payouts where provider_ref = $1 limit 1`,
    [reference]
  );
  const payout = rows[0];
  if (!payout) return 'not_found';
  if (payout.status === 'completed') return 'already';

  await db.transaction(async (client) => {
    await client.query(
      `update payouts set status = 'completed', completed_at = now(), failure_reason = null
        where id = $1 and status <> 'completed'`,
      [payout.id]
    );
    await client.query(
      `insert into notifications(profile_id, type, title, body, data)
       values ($1, 'payout_completed', 'Pagamento enviado', $2, $3::jsonb)`,
      [
        payout.provider_id,
        `O saque de MT ${payout.amount} foi enviado para os teus dados de pagamento.`,
        JSON.stringify({ payout_id: payout.id, reference }),
      ]
    );
  });

  return 'confirmed';
}

export async function failPayoutByReference(
  reference: string,
  reason?: string
): Promise<'failed' | 'already' | 'not_found'> {
  const result = await db.transaction(async (client) => {
    const { rows } = await client.query<PayoutRow>(
      `select id, provider_id, amount, status from payouts where provider_ref = $1 limit 1 for update`,
      [reference]
    );
    const payout = rows[0];
    if (!payout) return 'not_found' as const;
    if (payout.status === 'failed' || payout.status === 'completed') return 'already' as const;

    await client.query(
      `update payouts set status = 'failed', failure_reason = $2 where id = $1`,
      [payout.id, reason || 'Falha no envio']
    );
    await client.query(
      `select wallet_apply($1, 'refund', $2, 'Saque falhado — valor devolvido', null, $3::jsonb)`,
      [payout.provider_id, payout.amount, JSON.stringify({ payout_id: payout.id, reference })]
    );
    await client.query(
      `insert into notifications(profile_id, type, title, body, data)
       values ($1, 'payout_failed', 'Pagamento não enviado', $2, $3::jsonb)`,
      [
        payout.provider_id,
        `O saque de MT ${payout.amount} falhou. O valor foi devolvido à tua carteira.`,
        JSON.stringify({ payout_id: payout.id, reference }),
      ]
    );
    return 'failed' as const;
  });

  return result;
}

/** Reconcilia payouts em processamento consultando a PaySuite. */
export async function reconcileProcessingPayouts(): Promise<number> {
  const { rows } = await db.query<{ id: string; provider_ref: string }>(
    `select id, provider_ref from payouts
      where status = 'processing' and provider_ref is not null
      order by created_at asc limit 20`
  );
  let changed = 0;
  for (const row of rows) {
    const state = await getPaySuitePayoutByReference(row.provider_ref);
    if (state.paid) {
      await confirmPayoutByReference(row.provider_ref);
      changed += 1;
    } else if (state.failed) {
      await failPayoutByReference(row.provider_ref, 'PaySuite reportou falha');
      changed += 1;
    }
  }
  return changed;
}

/** Rejeita um pedido pendente pela equipa e devolve o valor � carteira. */
export async function rejectPayout(
  payoutId: string,
  reason = 'Rejeitado pela equipa'
): Promise<'rejected' | 'already' | 'not_found'> {
  const result = await db.transaction(async (client) => {
    const { rows } = await client.query<PayoutRow>(
      `select id, provider_id, amount, status from payouts where id = $1 for update`,
      [payoutId]
    );
    const payout = rows[0];
    if (!payout) return 'not_found' as const;
    if (payout.status !== 'pending') return 'already' as const;

    await client.query(
      `update payouts set status = 'failed', failure_reason = $2 where id = $1`,
      [payout.id, reason]
    );
    await client.query(
      `select wallet_apply($1, 'refund', $2, 'Saque rejeitado � valor devolvido', null, $3::jsonb)`,
      [payout.provider_id, payout.amount, JSON.stringify({ payout_id: payout.id })]
    );
    await client.query(
      `insert into notifications(profile_id, type, title, body, data)
       values ($1, 'payout_failed', 'Pagamento n�o aprovado', $2, $3::jsonb)`,
      [
        payout.provider_id,
        `O saque de MT ${payout.amount} n�o foi aprovado. O valor foi devolvido � tua carteira.`,
        JSON.stringify({ payout_id: payout.id }),
      ]
    );
    return 'rejected' as const;
  });

  return result;
}
