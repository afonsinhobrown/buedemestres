'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import {
  approvePlatformWithdrawal,
  createPlatformWithdrawal,
  updatePlatformSettings,
} from '@/lib/platform-withdrawals'

async function requireSuperadmin() {
  const session = await verifySession()
  if (session.role !== 'superadmin') throw new Error('Acesso restrito ao superadmin.')
  return session
}

async function requireApprover() {
  const session = await verifySession()
  if (!['superadmin', 'finance'].includes(session.role || '')) {
    throw new Error('Acesso restrito aos sócios.')
  }
  return session
}

export async function updatePartnerAccountAction(formData: FormData) {
  await requireSuperadmin()
  const id = String(formData.get('partnerId') || '')
  const method = String(formData.get('method') || 'bank_transfer')
  const accountName = String(formData.get('accountName') || '').trim()
  const msisdn = String(formData.get('msisdn') || '').trim() || null
  const bankName = String(formData.get('bankName') || '').trim() || null
  const accountNumber = String(formData.get('accountNumber') || '').trim() || null

  if (!id) throw new Error('Sócio inválido.')
  if (!['emola', 'mpesa', 'bank_transfer'].includes(method)) throw new Error('Método inválido.')
  if (accountName.length < 3) throw new Error('Indica o nome do titular.')

  await db.query(
    `update partners
        set method = $2, account_name = $3, msisdn = $4, bank_name = $5, account_number = $6, updated_at = now()
      where id = $1`,
    [id, method, accountName, msisdn, bankName, accountNumber]
  )
  revalidatePath('/superadmin/socios')
}

export async function linkPartnerProfileAction(formData: FormData) {
  await requireSuperadmin()
  const partnerId = String(formData.get('partnerId') || '')
  const profileId = String(formData.get('profileId') || '').trim() || null
  if (!partnerId) throw new Error('Sócio inválido.')

  if (profileId) {
    const { rows } = await db.query<{ id: string }>(`select id from profiles where id = $1`, [profileId])
    if (!rows[0]) throw new Error('Conta não encontrada.')
    const { rows: other } = await db.query<{ id: string }>(
      `select id from partners where profile_id = $1 and id <> $2`,
      [profileId, partnerId]
    )
    if (other[0]) throw new Error('Esta conta já está ligada a outro sócio.')
  }

  await db.query(`update partners set profile_id = $2, updated_at = now() where id = $1`, [partnerId, profileId])
  revalidatePath('/superadmin/socios')
}

export async function updatePlatformSettingsAction(formData: FormData) {
  await requireSuperadmin()
  const withdrawPct = Number(formData.get('withdrawPct') || 0) / 100
  const retainPct = Number(formData.get('retainPct') || 0) / 100
  const approvalRequired = String(formData.get('approvalRequired')) === 'true'
  await updatePlatformSettings({ withdrawPct, retainPct, approvalRequired })
  revalidatePath('/superadmin/socios')
}

export async function createPlatformWithdrawalAction() {
  const session = await requireSuperadmin()
  await createPlatformWithdrawal(session.userId)
  revalidatePath('/superadmin/socios')
}

export async function approvePlatformWithdrawalAction(formData: FormData) {
  const session = await requireApprover()
  const withdrawalId = String(formData.get('withdrawalId') || '')
  if (!withdrawalId) return
  await approvePlatformWithdrawal(withdrawalId, session.userId)
  revalidatePath('/superadmin/socios')
}
