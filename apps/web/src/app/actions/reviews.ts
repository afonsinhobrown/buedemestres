'use server'

import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const reviewSchema = z.object({
  jobId: z.string().uuid(),
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().optional(),
})

export async function submitReview(formData: FormData) {
  const session = await verifySession()
  if (!session?.userId) return { error: 'Não autenticado' }

  const data = Object.fromEntries(formData.entries())
  const result = reviewSchema.safeParse(data)
  if (!result.success) return { error: 'Dados inválidos' }

  try {
    // Obter provider do job
    const { rows: jobs } = await db.query(
      `SELECT provider_id, client_id, status FROM jobs WHERE id = $1`,
      [result.data.jobId]
    )
    if (jobs.length === 0) return { error: 'Trabalho não encontrado' }
    if (jobs[0].client_id !== session.userId) return { error: 'Apenas o cliente pode avaliar' }
    
    // DB Trigger "check_review_allowed" vai validar se o status é 'completed'
    await db.query(
      `INSERT INTO reviews (job_id, client_id, provider_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [result.data.jobId, session.userId, jobs[0].provider_id, result.data.rating, result.data.comment || null]
    )

    revalidatePath('/trabalhos')
    revalidatePath(`/p/[slug]`)
    return { success: true }
  } catch (error: any) {
    console.error('Erro ao submeter avaliação:', error)
    if (error.message?.includes('review_not_allowed')) {
      return { error: 'Só podes avaliar trabalhos concluídos' }
    }
    if (error.code === '23505') {
      return { error: 'Já avaliaste este trabalho' }
    }
    return { error: 'Erro ao guardar avaliação.' }
  }
}

export async function replyToReview(reviewId: string, reply: string) {
  const session = await verifySession()
  if (!session?.userId) return { error: 'Não autenticado' }

  try {
    const { rows: update } = await db.query(
      `UPDATE reviews 
       SET provider_reply = $1 
       WHERE id = $2 AND provider_id = $3 AND provider_reply IS NULL
       RETURNING id`,
      [reply, reviewId, session.userId]
    )

    if (update.length === 0) return { error: 'Não autorizado ou já respondido' }

    revalidatePath('/pro/avaliacoes')
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: 'Falha ao responder.' }
  }
}
