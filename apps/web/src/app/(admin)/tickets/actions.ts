'use server'

import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type ResolutionAction = 'release' | 'refund'

export async function replyTicket(ticketNumber: string, body: string) {
  const session = await verifySession()
  if (!['admin', 'superadmin', 'finance', 'support', 'moderator'].includes(session.role || '')) {
    return { error: 'Sem permissão' }
  }
  const message = body.trim()
  if (message.length < 1) return { error: 'Escreve uma resposta.' }

  try {
    const { rows } = await db.query<{ id: string }>(
      `select id from tickets where number = $1::bigint or id::text = $1 limit 1`,
      [ticketNumber]
    )
    const ticket = rows[0]
    if (!ticket) return { error: 'Ticket não encontrado' }

    await db.transaction(async (client) => {
      await client.query(
        `insert into ticket_messages(ticket_id, author_id, body) values ($1,$2,$3)`,
        [ticket.id, session.userId, message]
      )
      await client.query(
        `update tickets
            set status = case when status = 'open' then 'in_progress' else status end,
                first_response_at = coalesce(first_response_at, now()),
                updated_at = now()
          where id = $1`,
        [ticket.id]
      )
    })
    revalidatePath(`/tickets/${ticketNumber}`)
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erro ao responder.' }
  }
}

export async function resolveDispute(ticketNumber: string, action: ResolutionAction) {
  const session = await verifySession()
  if (!['admin', 'superadmin', 'finance', 'support'].includes(session.role || '')) {
    return { error: 'Sem permissão' }
  }

  try {
    const { rows } = await db.query<{
      id: string
      number: string
      related_job_id: string | null
      requester_id: string
      subject: string
    }>(
      `select id, number, related_job_id, requester_id, subject
         from tickets
        where number = $1::bigint or id::text = $1
        limit 1`,
      [ticketNumber]
    )
    const ticket = rows[0]
    if (!ticket) return { error: 'Ticket não encontrado' }
    if (!ticket.related_job_id) return { error: 'Ticket sem trabalho associado' }

    await db.transaction(async (client) => {
      const { rows: jobRows } = await client.query<{
        id: string
        request_id: string | null
        client_id: string
        provider_id: string
      }>(
        `select id, request_id, client_id, provider_id from jobs where id = $1 for update`,
        [ticket.related_job_id]
      )
      const job = jobRows[0]
      if (!job) throw new Error('Trabalho não encontrado')

      if (action === 'release') {
        await client.query(
          `insert into wallets(profile_id) values ($1) on conflict (profile_id) do nothing`,
          [job.provider_id]
        )
        await client.query(
          `update job_payments set status = 'held' where job_id = $1 and status = 'disputed'`,
          [job.id]
        )
        await client.query(
          `update job_addenda set status = 'held' where job_id = $1 and status = 'disputed'`,
          [job.id]
        )
        await client.query(`select release_job_payment($1)`, [job.id])
        await client.query(`select release_job_addenda($1)`, [job.id])

        if (job.request_id) {
          await client.query(
            `update service_requests set status = 'completed', updated_at = now() where id = $1`,
            [job.request_id]
          )
        }

        await client.query(
          `insert into notifications(profile_id, type, title, body, data)
           values
             ($1, 'dispute_resolved', 'Disputa resolvida', 'A equipa de apoio libertou o pagamento retido para a tua carteira.', $3::jsonb),
             ($2, 'dispute_resolved', 'Disputa resolvida', 'A equipa de apoio analisou o caso e libertou o pagamento ao mestre.', $3::jsonb)`,
          [
            job.provider_id,
            job.client_id,
            JSON.stringify({ job_id: job.id, ticket: ticket.number, action }),
          ]
        )
      } else {
        await client.query(
          `update job_payments set status = 'refunded', refunded_at = now()
            where job_id = $1 and status in ('disputed', 'held')`,
          [job.id]
        )
        await client.query(
          `update job_addenda set status = 'refunded'
            where job_id = $1 and status in ('disputed', 'held')`,
          [job.id]
        )
        await client.query(
          `update jobs set status = 'cancelled', cancel_reason = 'disputa_reembolsada', updated_at = now()
            where id = $1`,
          [job.id]
        )
        if (job.request_id) {
          await client.query(
            `update service_requests set status = 'cancelled', updated_at = now() where id = $1`,
            [job.request_id]
          )
        }
        await client.query(
          `update provider_presence set active_job_id = null where active_job_id = $1`,
          [job.id]
        )
        await client.query(
          `insert into notifications(profile_id, type, title, body, data)
           values
             ($1, 'dispute_resolved', 'Disputa resolvida', 'A equipa de apoio decidiu reembolsar o cliente. O valor não foi libertado.', $3::jsonb),
             ($2, 'dispute_resolved', 'Disputa resolvida', 'A equipa de apoio decidiu reembolsar o pagamento retido.', $3::jsonb)`,
          [
            job.provider_id,
            job.client_id,
            JSON.stringify({ job_id: job.id, ticket: ticket.number, action }),
          ]
        )
      }

      await client.query(
        `update tickets
            set status = 'resolved', resolved_at = now(), updated_at = now()
          where id = $1`,
        [ticket.id]
      )
      await client.query(
        `insert into ticket_events(ticket_id, actor_id, type, meta)
         values ($1, $2, 'dispute_resolved', $3::jsonb)`,
        [ticket.id, session.userId, JSON.stringify({ action })]
      )
      await client.query(
        `insert into ticket_messages(ticket_id, author_id, body)
         values ($1, $2, $3)`,
        [
          ticket.id,
          session.userId,
          action === 'release'
            ? 'Pagamento libertado ao mestre após análise da disputa.'
            : 'Pagamento reembolsado ao cliente após análise da disputa.',
        ]
      )
    })

    revalidatePath('/tickets')
    revalidatePath(`/tickets/${ticketNumber}`)
    return { success: true }
  } catch (error) {
    console.error('Erro ao resolver disputa:', error)
    return { error: error instanceof Error ? error.message : 'Erro ao resolver a disputa.' }
  }
}
