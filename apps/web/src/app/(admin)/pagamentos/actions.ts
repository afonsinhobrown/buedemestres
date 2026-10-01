'use server'

import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function confirmPayment(paymentId: string) {
  const session = await verifySession()
  if (session.role !== 'admin') return { error: 'Sem permissão' }

  try {
    // Calling the PL/pgSQL function complete_payment
    await db.query(`SELECT complete_payment($1)`, [paymentId])
    
    revalidatePath('/pagamentos')
    return { success: true }
  } catch (err: any) {
    console.error(err)
    return { error: 'Erro ao confirmar o pagamento.' }
  }
}

export async function rejectPayment(paymentId: string) {
  const session = await verifySession()
  if (session.role !== 'admin') return { error: 'Sem permissão' }

  try {
    await db.query(`UPDATE payments SET status = 'failed' WHERE id = $1 AND status = 'pending'`, [paymentId])
    
    revalidatePath('/pagamentos')
    return { success: true }
  } catch (err: any) {
    console.error(err)
    return { error: 'Erro ao rejeitar o pagamento.' }
  }
}
