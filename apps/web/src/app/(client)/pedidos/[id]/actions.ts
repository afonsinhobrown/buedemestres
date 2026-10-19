'use server'

import { db } from '@/lib/db'
import { normalizeRequestStatus } from '@/lib/job-flow'
import { getOptionalSession } from '@/lib/session'

export type RefundDestination = 'wallet' | 'paysuite'

/**
 * Cancela um pedido JÁ PAGO pelo cliente. O valor retido é estornado para o
 * destino escolhido (carteira do cliente ou devolução externa via PaySuite).
 * A app web usa sessão JWT própria, por isso passamos o actor explicitamente.
 */
export async function cancelJobByClient(identifier: string, destination: RefundDestination = 'wallet') {
  const session = await getOptionalSession()
  if (!session?.userId) return { ok: false as const, error: 'Não autenticado.' }

  try {
    const { rows } = await db.query<{ result: unknown }>(
      `select cancel_job_by_client_as($1, j.id, $3) as result
         from jobs j
        where j.id::text = $2 or j.request_id::text = $2
        limit 1`,
      [session.userId, identifier, destination]
    )
    const result = rows[0]?.result as { ok?: boolean; error?: string } | undefined
    if (!result) return { ok: false as const, error: 'Trabalho não encontrado.' }
    return result.ok
      ? { ok: true as const, result }
      : { ok: false as const, error: result.error ?? 'Não foi possível cancelar.' }
  } catch (error) {
    console.error('[cancelJobByClient]', error)
    return { ok: false as const, error: 'indisponível' }
  }
}

export async function checkDirectJobStatus(identifier: string) {
  const job = await db.query(`
    SELECT status FROM jobs WHERE id = $1 OR request_id = $1 LIMIT 1
  `, [identifier])

  if (job.rows[0]?.status) return job.rows[0].status as string

  const request = await db.query(`
    SELECT status FROM service_requests WHERE id = $1 LIMIT 1
  `, [identifier])

  return normalizeRequestStatus(request.rows[0]?.status)
}
