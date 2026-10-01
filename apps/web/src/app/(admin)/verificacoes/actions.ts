'use server'

import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function reviewVerification(id: string, action: 'approve' | 'reject', reason?: string) {
  const session = await verifySession()
  if (session.role !== 'admin') return { error: 'Sem permissão' }

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
          SET verification = 'approved', verified_at = NOW()
          WHERE profile_id = $1
        `, [providerId])
      } else if (providerId && action === 'reject') {
        await client.query(`
          UPDATE provider_profiles
          SET verification = 'rejected'
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
