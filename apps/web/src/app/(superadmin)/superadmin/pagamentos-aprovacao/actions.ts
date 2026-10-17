'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { dispatchPayout, rejectPayout } from '@/lib/payouts'

async function requireSuperadmin() {
  const session = await verifySession()
  if (session.role !== 'superadmin') throw new Error('Acesso restrito ao superadmin.')
  return session
}

export async function togglePayoutApproval(formData: FormData) {
  await requireSuperadmin()
  const enabled = String(formData.get('enabled')) === 'true'
  await db.query(
    `insert into app_settings(key, value, updated_at)
     values ('payout_require_approval', $1::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(enabled)]
  )
  revalidatePath('/superadmin/pagamentos-aprovacao')
  revalidatePath('/superadmin/financeiro')
}

export async function approvePayoutAction(formData: FormData) {
  await requireSuperadmin()
  const payoutId = String(formData.get('payoutId') || '')
  if (!payoutId) return
  await dispatchPayout(payoutId, process.env.NEXT_PUBLIC_SITE_URL || undefined)
  revalidatePath('/superadmin/pagamentos-aprovacao')
  revalidatePath('/superadmin/financeiro')
}

export async function rejectPayoutAction(formData: FormData) {
  await requireSuperadmin()
  const payoutId = String(formData.get('payoutId') || '')
  if (!payoutId) return
  await rejectPayout(payoutId, 'Rejeitado pela equipa da plataforma')
  revalidatePath('/superadmin/pagamentos-aprovacao')
  revalidatePath('/superadmin/financeiro')
}
