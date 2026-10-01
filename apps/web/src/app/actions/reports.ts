'use server'

import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'

export async function submitReport(targetType: 'provider' | 'review' | 'message' | 'request', targetId: string, reason: string) {
  const session = await verifySession()
  if (!session?.userId) return { error: 'Não autenticado' }

  if (!reason || reason.trim().length < 5) {
    return { error: 'Motivo demasiado curto' }
  }

  try {
    await db.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [session.userId, targetType, targetId, reason]
    )
    return { success: true }
  } catch (error) {
    console.error('Erro ao reportar:', error)
    return { error: 'Não foi possível registar a denúncia.' }
  }
}
