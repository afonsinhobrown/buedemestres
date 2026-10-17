import { db } from '@/lib/db';
import { createPaySuitePayout, getPaySuitePayoutByReference, type PaySuitePayoutMethod } from '@/lib/paysuite';

type Partner = {
  id: string;
  name: string;
  email: string | null;
  share_pct: string;
  profile_id: string | null;
  method: string;
  account_name: string | null;
  msisdn: string | null;
  bank_name: string | null;
  account_number: string | null;
  is_active: boolean;
};

type Withdrawal = {
  id: string;
  available_revenue: string;
  withdraw_pct: string;
  retain_pct: string;
  distributed_amount: string;
  retained_amount: string;
  status: string;
  approval_required: boolean;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function digits(value: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function telefoneLocal(value: string | null) {
  let d = digits(value);
  if (d.startsWith('258') && d.length === 12) d = d.slice(3);
  return d.length === 9 ? d : null;
}

function webhookUrlFor(origin?: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const base = origin || (/^https:\/\//i.test(site) ? site : '');
  if (!base) return process.env.PAYSUITE_WEBHOOK_URL || undefined;
  return `${base.replace(/\/$/, '')}/api/webhooks/paysuite`;
}

export async function listPartners(): Promise<Partner[]> {
  const { rows } = await db.query<Partner>(`select * from partners order by share_pct desc`);
  return rows;
}

export async function getPlatformSettings() {
  const { rows } = await db.query<{ key: string; value: unknown }>(
    `select key, value from app_settings
      where key in ('platform_withdraw_pct','platform_retain_pct','platform_withdrawal_approval')`
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    withdrawPct: Number(map.get('platform_withdraw_pct') ?? 0.5),
    retainPct: Number(map.get('platform_retain_pct') ?? 0.5),
    approvalRequired: map.get('platform_withdrawal_approval') !== false && String(map.get('platform_withdrawal_approval')) !== 'false',
  };
}

export async function updatePlatformSettings(input: {
  withdrawPct: number;
  retainPct: number;
  approvalRequired: boolean;
}) {
  const withdrawPct = Math.min(1, Math.max(0, input.withdrawPct));
  const retainPct = Math.min(1, Math.max(0, input.retainPct));
  if (Math.abs(withdrawPct + retainPct - 1) > 0.0001) {
    throw new Error('As percentagens de saque e retenção devem somar 100%.');
  }
  await db.transaction(async (client) => {
    await client.query(
      `insert into app_settings(key,value,updated_at) values ('platform_withdraw_pct',$1::jsonb,now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(withdrawPct)]
    );
    await client.query(
      `insert into app_settings(key,value,updated_at) values ('platform_retain_pct',$1::jsonb,now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(retainPct)]
    );
    await client.query(
      `insert into app_settings(key,value,updated_at) values ('platform_withdrawal_approval',$1::jsonb,now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(input.approvalRequired)]
    );
  });
}

export async function getRevenueSummary() {
  const [{ rows: revenueRows }, { rows: consumedRows }] = await Promise.all([
    db.query<{ total: string }>(`select coalesce(sum(amount),0) as total from platform_revenue`),
    db.query<{ consumed: string }>(
      `select coalesce(sum(available_revenue),0) as consumed from platform_withdrawals
        where status in ('pending_approval','processing','completed')`
    ),
  ]);
  const total = Number(revenueRows[0]?.total || 0);
  const consumed = Number(consumedRows[0]?.consumed || 0);
  const available = Math.max(0, round2(total - consumed));
  return { total: round2(total), consumed: round2(consumed), available };
}

export async function createPlatformWithdrawal(requestedBy: string) {
  const settings = await getPlatformSettings();
  const summary = await getRevenueSummary();
  if (summary.available <= 0) throw new Error('Não há receita disponível para distribuir.');

  const available = summary.available;
  const distributed = round2(available * settings.withdrawPct);
  const retained = round2(available - distributed);
  const status = settings.approvalRequired ? 'pending_approval' : 'processing';

  const { rows } = await db.query<{ id: string }>(
    `insert into platform_withdrawals(
       available_revenue, withdraw_pct, retain_pct, distributed_amount, retained_amount,
       status, approval_required, requested_by
     ) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [available, settings.withdrawPct, settings.retainPct, distributed, retained, status, settings.approvalRequired, requestedBy]
  );
  const id = rows[0].id;
  if (!settings.approvalRequired) {
    await processPlatformWithdrawal(id);
  }
  return id;
}

export async function approvePlatformWithdrawal(withdrawalId: string, userId: string) {
  const partnerRes = await db.query<Partner>(`select * from partners where profile_id = $1 and is_active`, [userId]);
  const partner = partnerRes.rows[0];
  if (!partner) throw new Error('A tua conta não está ligada a nenhum sócio.');

  const wRes = await db.query<Withdrawal>(`select * from platform_withdrawals where id = $1`, [withdrawalId]);
  const withdrawal = wRes.rows[0];
  if (!withdrawal) throw new Error('Distribuição não encontrada.');
  if (withdrawal.status !== 'pending_approval') throw new Error('Esta distribuição já não está pendente.');

  await db.query(
    `insert into platform_withdrawal_approvals(withdrawal_id, partner_id, approved_by)
     values ($1,$2,$3)
     on conflict do nothing`,
    [withdrawalId, partner.id, userId]
  );

  const { rows: countRows } = await db.query<{ total: string }>(
    `select count(*)::text as total from partners where is_active`
  );
  const activePartners = Number(countRows[0]?.total || 0);
  const { rows: apprRows } = await db.query<{ total: string }>(
    `select count(*)::text as total from platform_withdrawal_approvals where withdrawal_id = $1`,
    [withdrawalId]
  );
  const approvals = Number(apprRows[0]?.total || 0);

  if (approvals >= activePartners) {
    await processPlatformWithdrawal(withdrawalId);
  }
}

export async function processPlatformWithdrawal(withdrawalId: string, origin?: string) {
  const wRes = await db.query<Withdrawal>(`select * from platform_withdrawals where id = $1`, [withdrawalId]);
  const withdrawal = wRes.rows[0];
  if (!withdrawal) return;
  if (!['pending_approval', 'processing'].includes(withdrawal.status)) return;

  if (withdrawal.approval_required) {
    const [{ rows: countRows }, { rows: apprRows }] = await Promise.all([
      db.query<{ total: string }>(`select count(*)::text as total from partners where is_active`),
      db.query<{ total: string }>(
        `select count(*)::text as total from platform_withdrawal_approvals where withdrawal_id = $1`,
        [withdrawalId]
      ),
    ]);
    if (Number(apprRows[0]?.total || 0) < Number(countRows[0]?.total || 0)) return;
  }

  const { rows: existing } = await db.query<{ total: string }>(
    `select count(*)::text as total from partner_payouts where withdrawal_id = $1`,
    [withdrawalId]
  );
  if (Number(existing[0]?.total || 0) > 0) return;

  const { rows: partners } = await db.query<Partner>(
    `select * from partners where is_active order by id`
  );
  if (partners.length === 0) throw new Error('Sem sócios ativos.');

  const total = round2(Number(withdrawal.distributed_amount));
  let remaining = total;
  const payouts = partners.map((partner, index) => {
    const amount =
      index === partners.length - 1 ? remaining : round2(total * Number(partner.share_pct));
    remaining = round2(remaining - amount);
    return { partner, amount };
  });

  await db.transaction(async (client) => {
    for (const { partner, amount } of payouts) {
      if (amount <= 0) continue;
      await client.query(
        `insert into partner_payouts(
           withdrawal_id, partner_id, amount, method, msisdn, account_name, bank_name, account_number
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          withdrawalId,
          partner.id,
          amount,
          partner.method,
          partner.msisdn,
          partner.account_name,
          partner.bank_name,
          partner.account_number,
        ]
      );
    }
    await client.query(
      `update platform_withdrawals set status = 'processing', processed_at = now() where id = $1`,
      [withdrawalId]
    );
  });

  await dispatchPartnerPayouts(withdrawalId, origin);
}

async function dispatchPartnerPayouts(withdrawalId: string, origin?: string) {
  const { rows } = await db.query<{
    id: string;
    partner_id: string;
    amount: string;
    method: string;
    msisdn: string | null;
    account_name: string | null;
    bank_name: string | null;
    account_number: string | null;
    status: string;
  }>(
    `select id, partner_id, amount, method, msisdn, account_name, bank_name, account_number, status
       from partner_payouts where withdrawal_id = $1 and status = 'pending'`,
    [withdrawalId]
  );

  for (const payout of rows) {
    let method: PaySuitePayoutMethod;
    let beneficiary: { phone?: string; nib?: string; holder: string };

    if (payout.method === 'mpesa' || payout.method === 'emola') {
      const phone = telefoneLocal(payout.msisdn);
      if (!phone) {
        await markPartnerPayoutFailed(payout.id, 'Número de telemóvel inválido');
        continue;
      }
      method = payout.method;
      beneficiary = { phone, holder: payout.account_name || payout.partner_id };
    } else if (payout.method === 'bank_transfer') {
      const nib = digits(payout.account_number);
      if (nib.length !== 21) {
        await markPartnerPayoutFailed(payout.id, 'NIB inválido');
        continue;
      }
      method = 'bank';
      beneficiary = { nib, holder: payout.account_name || payout.partner_id };
    } else {
      await markPartnerPayoutFailed(payout.id, 'Método não suportado');
      continue;
    }

    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const reference = `BMPRT${stamp}${rand}`.slice(0, 30);

    const claim = await db.query(
      `update partner_payouts set status = 'processing', provider_ref = $2
        where id = $1 and status = 'pending' returning id`,
      [payout.id, reference]
    );
    if (claim.rowCount === 0) continue;

    try {
      await createPaySuitePayout({
        amountMZN: Number(payout.amount),
        reference,
        method,
        beneficiary,
        description: `Sócio ${payout.partner_id} — Bué de Mestres`,
        webhookUrl: webhookUrlFor(origin),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha no envio';
      await markPartnerPayoutFailed(payout.id, message);
    }
  }

  await refreshWithdrawalStatus(withdrawalId);
}

async function markPartnerPayoutFailed(partnerPayoutId: string, reason: string) {
  await db.query(
    `update partner_payouts set status = 'failed', failure_reason = $2 where id = $1`,
    [partnerPayoutId, reason]
  );
}

export async function confirmPartnerPayoutByReference(reference: string): Promise<'confirmed' | 'already' | 'not_found'> {
  const { rows } = await db.query<{ id: string; withdrawal_id: string; status: string }>(
    `select id, withdrawal_id, status from partner_payouts where provider_ref = $1 limit 1`,
    [reference]
  );
  const payout = rows[0];
  if (!payout) return 'not_found';
  if (payout.status === 'completed') return 'already';
  await db.query(
    `update partner_payouts set status = 'completed', completed_at = now() where id = $1`,
    [payout.id]
  );
  await refreshWithdrawalStatus(payout.withdrawal_id);
  return 'confirmed';
}

export async function failPartnerPayoutByReference(reference: string, reason?: string): Promise<'failed' | 'already' | 'not_found'> {
  const { rows } = await db.query<{ id: string; withdrawal_id: string; status: string }>(
    `select id, withdrawal_id, status from partner_payouts where provider_ref = $1 limit 1`,
    [reference]
  );
  const payout = rows[0];
  if (!payout) return 'not_found';
  if (['failed', 'completed'].includes(payout.status)) return 'already';
  await db.query(
    `update partner_payouts set status = 'failed', failure_reason = $2 where id = $1`,
    [payout.id, reason || 'PaySuite reportou falha']
  );
  await refreshWithdrawalStatus(payout.withdrawal_id);
  return 'failed';
}

async function refreshWithdrawalStatus(withdrawalId: string) {
  const { rows } = await db.query<{ pending: string; processing: string; completed: string; failed: string }>(
    `select
       count(*) filter (where status = 'pending')::text as pending,
       count(*) filter (where status = 'processing')::text as processing,
       count(*) filter (where status = 'completed')::text as completed,
       count(*) filter (where status = 'failed')::text as failed
     from partner_payouts where withdrawal_id = $1`,
    [withdrawalId]
  );
  const c = rows[0];
  if (!c) return;
  if (Number(c.failed) > 0) {
    await db.query(
      `update platform_withdrawals set status = 'failed',
         failure_reason = 'Um ou mais pagamentos de sócios falharam', completed_at = now()
       where id = $1 and status <> 'completed'`,
      [withdrawalId]
    );
  } else if (Number(c.completed) > 0 && Number(c.pending) === 0 && Number(c.processing) === 0) {
    await db.query(
      `update platform_withdrawals set status = 'completed', completed_at = now() where id = $1`,
      [withdrawalId]
    );
  }
}

export async function reconcileProcessingPartnerPayouts(): Promise<number> {
  const { rows } = await db.query<{ id: string; withdrawal_id: string; provider_ref: string }>(
    `select id, withdrawal_id, provider_ref from partner_payouts
      where status = 'processing' and provider_ref is not null
      order by created_at asc limit 20`
  );
  let changed = 0;
  for (const row of rows) {
    const state = await getPaySuitePayoutByReference(row.provider_ref);
    if (state.paid) {
      await confirmPartnerPayoutByReference(row.provider_ref);
      changed += 1;
    } else if (state.failed) {
      await failPartnerPayoutByReference(row.provider_ref, 'PaySuite reportou falha');
      changed += 1;
    }
  }
  return changed;
}
