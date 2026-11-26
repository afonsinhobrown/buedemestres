'use server'

import { db } from '@/lib/db'
import { normalizeRequestStatus } from '@/lib/job-flow'
import { getOptionalSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

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
  proposal_id: string | null
  proposal_amount: string | null
  proposal_description: string | null
  proposal_status: string | null
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
            proposal.id as proposal_id, proposal.amount::text as proposal_amount,
            proposal.description as proposal_description, proposal.status as proposal_status,
            j.scheduled_at::text, j.created_at::text
       FROM jobs j
       JOIN provider_profiles pp ON pp.profile_id = j.provider_id
       LEFT JOIN service_requests sr ON sr.id = j.request_id
       LEFT JOIN districts d ON d.id = sr.district_id
       LEFT JOIN categories c ON c.id = sr.category_id
       LEFT JOIN job_payments jp ON jp.job_id = j.id
       LEFT JOIN LATERAL (
         SELECT p.id, p.amount, p.description, p.status
           FROM job_price_proposals p
          WHERE p.job_id = j.id
          ORDER BY p.created_at DESC
          LIMIT 1
       ) proposal ON true
      WHERE j.id::text = $1 OR j.request_id::text = $1
      LIMIT 1`,
    [identifier]
  )

  return rows[0] ?? null
}

export async function respondToProposal(
  identifier: string,
  decision: 'accept' | 'reject'
): Promise<{ ok: boolean; error?: string }> {
  const session = await getOptionalSession()
  if (!session?.userId) return { ok: false, error: 'Entra na tua conta para responder.' }

  try {
    const { rows } = await db.query<{
      proposal_id: string
      amount: string
      job_id: string
      provider_id: string
      request_id: string | null
    }>(
      `select p.id as proposal_id, p.amount::text, j.id as job_id, j.provider_id, j.request_id
         from jobs j
         join lateral (
           select id, amount
             from job_price_proposals
            where job_id = j.id and status = 'pending'
            order by created_at desc
            limit 1
         ) p on true
        where (j.id::text = $1 or j.request_id::text = $1)
          and j.client_id = $2
        limit 1`,
      [identifier, session.userId]
    )

    const proposal = rows[0]
    if (!proposal) return { ok: false, error: 'Orçamento não encontrado ou já respondido.' }

    if (decision === 'accept') {
      await db.transaction(async (client) => {
        await client.query(`update job_price_proposals set status = 'accepted' where id = $1`, [proposal.proposal_id])
        await client.query(
          `update jobs
              set status = 'price_agreed',
                  agreed_amount = $2,
                  price_proposed = $2,
                  negotiation_state = 'acordado',
                  turn_owner = null,
                  turn_expires_at = null,
                  updated_at = now()
            where id = $1`,
          [proposal.job_id, proposal.amount]
        )
        if (proposal.request_id) {
          await client.query(
            `update service_requests
                set status = 'accepted', budget_max = $2, updated_at = now()
              where id = $1`,
            [proposal.request_id, proposal.amount]
          )
        }
        await client.query(
          `insert into notifications(profile_id, type, title, body, data)
           values ($1, 'price_accepted', 'Orçamento aceite', $2, $3::jsonb)`,
          [
            proposal.provider_id,
            `O cliente aceitou o teu orçamento de ${proposal.amount} MT.`,
            JSON.stringify({ jobId: proposal.job_id, amount: proposal.amount }),
          ]
        ).catch(() => undefined)
      })
    } else {
      await db.transaction(async (client) => {
        await client.query(`update job_price_proposals set status = 'rejected' where id = $1`, [proposal.proposal_id])
        await client.query(
          `update jobs
              set status = 'cancelled',
                  cancel_reason = 'orçamento recusado pelo cliente',
                  negotiation_state = 'recusado',
                  turn_owner = null,
                  turn_expires_at = null,
                  updated_at = now()
            where id = $1`,
          [proposal.job_id]
        )
        if (proposal.request_id) {
          await client.query(
            `update service_requests
                set status = 'open', target_provider_id = null, budget_max = null, updated_at = now()
              where id = $1`,
            [proposal.request_id]
          )
        }
      })
    }

    revalidatePath(`/pedidos/${identifier}`)
    return { ok: true }
  } catch (error) {
    console.error('[respondToProposal]', error)
    return { ok: false, error: 'Não foi possível responder ao orçamento.' }
  }
}
