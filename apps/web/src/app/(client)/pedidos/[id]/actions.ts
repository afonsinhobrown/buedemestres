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

export type JobTrackingDetails = {
  id: string
  request_id: string | null
  status: string
  agreed_amount: string | null
  provider_name: string
  provider_slug: string | null
  category_name: string | null
  district_name: string | null
  address: string | null
  lat: number | null
  lng: number | null
  payment_status: string | null
  payment_amount: string | null
  scheduled_at: string | null
  created_at: string
}

export async function getJobTrackingDetails(identifier: string): Promise<JobTrackingDetails | null> {
  const { rows } = await db.query<JobTrackingDetails>(
    `SELECT j.id::text, j.request_id::text, j.status, j.agreed_amount::text,
            pp.business_name as provider_name, pp.slug as provider_slug,
            c.name as category_name, d.name as district_name, sr.address,
            coalesce(ST_Y(sr.location::geometry), pp.lat::float8)::float8 as lat,
            coalesce(ST_X(sr.location::geometry), pp.lng::float8)::float8 as lng,
            jp.status as payment_status, jp.amount::text as payment_amount,
            j.scheduled_at::text, j.created_at::text
       FROM jobs j
       JOIN provider_profiles pp ON pp.profile_id = j.provider_id
       LEFT JOIN service_requests sr ON sr.id = j.request_id
       LEFT JOIN districts d ON d.id = sr.district_id
       LEFT JOIN categories c ON c.id = sr.category_id
       LEFT JOIN job_payments jp ON jp.job_id = j.id
      WHERE j.id::text = $1 OR j.request_id::text = $1
      LIMIT 1`,
    [identifier]
  )

  return rows[0] ?? null
}
