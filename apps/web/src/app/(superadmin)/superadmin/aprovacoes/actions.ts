'use server'

import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function decideApproval(id: string, approve: boolean) {
  const session = await verifySession()
  if (session.role !== 'superadmin' && session.role !== 'finance') return { error: 'Sem permissão' }

  try {
    // Calling the decide_approval RPC
    await db.query(`SELECT decide_approval($1, $2)`, [id, approve])
    revalidatePath('/superadmin/aprovacoes')
    return { success: true }
  } catch (err: any) {
    console.error(err)
    if (err.message.includes('cannot_approve_own_request')) {
      return { error: 'Não podes aprovar o teu próprio pedido (princípio dos 4 olhos).' }
    }
    return { error: 'Erro ao processar a decisão.' }
  }
}
