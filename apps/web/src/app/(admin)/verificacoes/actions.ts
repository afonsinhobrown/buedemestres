'use server'

import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function reviewVerification(id: string, action: 'approve' | 'reject', reason?: string) {
  const session = await verifySession()
  if (!['admin', 'superadmin'].includes(session.role)) return { error: 'Sem permissão' }

  try {
    await db.transaction(async (client) => {
      const status = action === 'approve' ? 'approved' : 'rejected'
      
      const updateDocRes = await client.query(`
        UPDATE verification_documents 
        SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW()
        WHERE id = $4
        RETURNING provider_id
      `, [status, action === 'reject' ? reason : null, session.userId, id])

      const providerId = updateDocRes.rows[0]?.provider_id
      
      if (providerId && action === 'approve') {
        await client.query(`
          UPDATE provider_profiles
          SET verification = 'approved',
              verified_at = NOW(),
              temporary_access_until = null,
              temporary_access_granted_by = null,
              temporary_access_reason = null,
              is_published = true,
              is_available = true
          WHERE profile_id = $1
        `, [providerId])
      } else if (providerId && action === 'reject') {
        await client.query(`
          UPDATE provider_profiles
          SET verification = 'rejected',
              temporary_access_until = null,
              temporary_access_granted_by = null,
              temporary_access_reason = null
          WHERE profile_id = $1
        `, [providerId])
      }
    })

    revalidatePath('/verificacoes')
    return { success: true }
  } catch (err: any) {
    console.error(err)
    return { error: 'Erro ao rever a verificação.' }
  }
}

export async function grantTemporaryProviderAccess(providerId: string, days: number, reason?: string) {
  const session = await verifySession()
  if (!['admin', 'superadmin'].includes(session.role)) return { error: 'Sem permissão' }
  if (!providerId) return { error: 'Mestre inválido.' }

  const safeDays = Math.floor(Number(days))
  if (!Number.isFinite(safeDays) || safeDays < 1 || safeDays > 90) {
    return { error: 'O prazo deve estar entre 1 e 90 dias.' }
  }

  try {
    await db.transaction(async (client) => {
      const { rows } = await client.query<{ business_name: string }>(
        `update provider_profiles
            set verification = 'approved',
                verified_at = coalesce(verified_at, now()),
                temporary_access_until = now() + ($2::int * interval '1 day'),
                temporary_access_granted_by = $3,
                temporary_access_reason = $4,
                is_published = true,
                is_available = true,
                updated_at = now()
          where profile_id = $1
          returning business_name`,
        [providerId, safeDays, session.userId, reason || null]
      )

      if (!rows[0]) throw new Error('Mestre não encontrado.')

      await client.query(
        `insert into notifications(profile_id, type, title, body, data)
         values ($1, 'temporary_access', 'Acesso temporário aprovado', $2, $3::jsonb)`,
        [
          providerId,
          `Tens acesso temporário por ${safeDays} dias. Completa os documentos para manteres o acesso.`,
          JSON.stringify({ days: safeDays, until: new Date(Date.now() + safeDays * 86400000).toISOString() }),
        ]
      ).catch(() => undefined)
    })

    revalidatePath('/verificacoes')
    revalidatePath('/pro/trabalhos')
    return { success: true }
  } catch (error) {
    console.error('[grantTemporaryProviderAccess]', error)
    return { error: error instanceof Error ? error.message : 'Não foi possível dar acesso temporário.' }
  }
}

export async function revokeTemporaryProviderAccess(providerId: string) {
  const session = await verifySession()
  if (!['admin', 'superadmin'].includes(session.role)) return { error: 'Sem permissão' }
  if (!providerId) return { error: 'Mestre inválido.' }

  try {
    await db.query(
      `update provider_profiles
          set verification = 'none',
              temporary_access_until = null,
              temporary_access_granted_by = null,
              temporary_access_reason = null,
              is_published = false,
              is_available = false,
              updated_at = now()
        where profile_id = $1`,
      [providerId]
    )

    revalidatePath('/verificacoes')
    revalidatePath('/pro/trabalhos')
    return { success: true }
  } catch (error) {
    console.error('[revokeTemporaryProviderAccess]', error)
    return { error: 'Não foi possível remover o acesso temporário.' }
  }
}
