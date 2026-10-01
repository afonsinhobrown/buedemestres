'use server'

import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createTopUpPayment(formData: FormData) {
  const session = await verifySession()
  if (!session?.userId) {
    return { error: 'Não autenticado' }
  }

  const amount = Number(formData.get('amount'))
  if (!amount || amount < 50) {
    return { error: 'O valor mínimo é 50 MT.' }
  }

  try {
    // 1. Criar registo de pagamento (método manual para agora)
    const { rows } = await db.query(
      `INSERT INTO payments (profile_id, amount, method, status)
       VALUES ($1, $2, 'manual', 'pending')
       RETURNING id`,
      [session.userId, amount]
    )

    const paymentId = rows[0].id

    // 2. Como estamos no provider "manual" em ambiente de dev/demo,
    // simulamos a aprovação automática instantânea chamando o RPC complete_payment
    await db.query(`SELECT complete_payment($1)`, [paymentId])

    revalidatePath('/pro/carteira')
    return { success: true }
  } catch (error: any) {
    console.error('Erro ao carregar saldo:', error)
    return { error: 'Falha ao processar carregamento.' }
  }
}

export async function subscribeToPlan(formData: FormData) {
  const session = await verifySession()
  if (!session?.userId) {
    return { error: 'Não autenticado' }
  }

  const planId = Number(formData.get('planId'))
  
  try {
    // A função RPC 'purchase_plan' já lida com o débito na carteira,
    // alteração da subscrição e inserção de logs.
    // Lança erro 'insufficient_funds' se o saldo não chegar.
    await db.query(`SELECT purchase_plan($1, $2)`, [session.userId, planId])

    // Se o plano permitir, actualizamos o estado de publicação do perfil
    // Para simplificar, consideramos que a activação de um plano pago publica o perfil.
    await db.query(
      `UPDATE provider_profiles SET is_published = true WHERE profile_id = $1`,
      [session.userId]
    )

    revalidatePath('/pro/planos')
    revalidatePath('/pro/carteira')
    return { success: true }
  } catch (error: any) {
    console.error('Erro ao subscrever plano:', error)
    if (error.message?.includes('insufficient_funds')) {
      return { error: 'Saldo insuficiente na carteira.' }
    }
    return { error: 'Erro ao processar a subscrição.' }
  }
}
