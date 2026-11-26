'use server'

import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { notify } from '@/lib/pusher'
import { revalidatePath } from 'next/cache'

export type ProposalState = {
  success?: boolean
  error?: string
}

export async function sendPriceProposalAction(
  _prev: ProposalState | undefined,
  formData: FormData
): Promise<ProposalState> {
  const session = await verifySession()
  const requestId = String(formData.get('requestId') || '')
  const amount = Number(formData.get('amount'))
  const message = String(formData.get('message') || '').trim()

  if (!requestId) return { error: 'Pedido inválido.' }
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Indica um valor válido.' }

  try {
    const result = await db.transaction(async (client) => {
      const requestRes = await client.query<{
        id: string
        client_id: string
        title: string
        status: string
        target_provider_id: string | null
      }>(
        `select id, client_id, title, status, target_provider_id
           from service_requests
          where id = $1
          limit 1`,
        [requestId]
      )
      const request = requestRes.rows[0]
      if (!request) throw new Error('Pedido não encontrado.')
      if (request.target_provider_id && request.target_provider_id !== session.userId) {
        throw new Error('Este pedido está atribuído a outro mestre.')
      }
      if (['accepted', 'price_agreed', 'completed', 'cancelled', 'expired'].includes(request.status)) {
        throw new Error('Este pedido já não está disponível.')
      }

      const providerRes = await client.query<{ is_published: boolean }>(
        `select is_published from provider_profiles where profile_id = $1 limit 1`,
        [session.userId]
      )
      if (!providerRes.rows[0]?.is_published) {
        throw new Error('O teu perfil de mestre ainda não está publicado.')
      }

      try {
        await client.query('select expire_stale_negotiations()')
      } catch {
        // A função pode não existir em bases antigas.
      }

      const jobRes = await client.query<{ id: string }>(
        `insert into jobs(
           request_id, client_id, provider_id, status, price_proposed,
           negotiation_state, turn_owner, turn_expires_at, updated_at
         )
         values ($1, $2, $3, 'price_proposed', $4, 'aguardando_cliente', 'client', now() + interval '30 minutes', now())
         on conflict (request_id) do update
           set provider_id = excluded.provider_id,
               status = 'price_proposed',
               price_proposed = excluded.price_proposed,
               agreed_amount = null,
               negotiation_state = 'aguardando_cliente',
               turn_owner = 'client',
               turn_expires_at = now() + interval '30 minutes',
               updated_at = now()
         returning id`,
        [requestId, request.client_id, session.userId, amount]
      )
      const jobId = jobRes.rows[0].id

      await client.query(
        `update job_price_proposals
            set status = 'withdrawn'
          where job_id = $1 and proposed_by = $2 and status = 'pending'`,
        [jobId, session.userId]
      )

      await client.query(
        `insert into job_price_proposals(job_id, proposed_by, amount, description, status)
         values ($1, $2, $3, $4, 'pending')`,
        [jobId, session.userId, amount, message || null]
      )

      await client.query(
        `update service_requests
            set status = 'price_proposed',
                budget_max = $2,
                target_provider_id = $3,
                updated_at = now()
          where id = $1`,
        [requestId, amount, session.userId]
      )

      await client.query(
        `insert into notifications(profile_id, type, title, body, data)
         values ($1, 'price_proposed', 'Orçamento recebido', $2, $3::jsonb)`,
        [
          request.client_id,
          `O mestre respondeu ao teu pedido com ${amount} MT.`,
          JSON.stringify({ jobId, requestId, amount }),
        ]
      ).catch(() => undefined)

      return { jobId, clientId: request.client_id }
    })

    try {
      await notify(`job-${result.jobId}`, 'price_proposed', { jobId: result.jobId, amount })
    } catch {
      // Pusher é opcional
    }

    revalidatePath('/pro/trabalhos')
    revalidatePath(`/pedidos/${requestId}`)
    return { success: true }
  } catch (error) {
    console.error('[sendPriceProposalAction]', error)
    const message = error instanceof Error ? error.message : ''
    if (message.includes('provider_busy')) {
      return { error: 'Já tens um serviço ativo. Conclui ou cancela esse serviço antes de responderes a outro pedido.' }
    }
    if (message.includes('sandbox_limit_exceeded')) {
      return { error: 'No modo sandbox, o orçamento tem de estar entre 1 e 10 MT.' }
    }
    return { error: message || 'Não foi possível enviar o orçamento.' }
  }
}
