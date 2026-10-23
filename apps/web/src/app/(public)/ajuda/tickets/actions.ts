'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'

const MAX_OPEN_TICKETS = 5

function normalize(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

export async function createTicketAction(formData: FormData) {
  const session = await verifySession()
  const categoryId = Number(formData.get('category_id'))
  const subject = normalize(formData.get('subject'))
  const description = normalize(formData.get('description'))

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    redirect('/ajuda/tickets/novo?erro=' + encodeURIComponent('Escolhe uma categoria válida.'))
  }
  if (subject.length < 5 || subject.length > 120) {
    redirect('/ajuda/tickets/novo?erro=' + encodeURIComponent('O assunto deve ter entre 5 e 120 caracteres.'))
  }
  if (description.length < 10 || description.length > 5000) {
    redirect('/ajuda/tickets/novo?erro=' + encodeURIComponent('A descrição deve ter entre 10 e 5000 caracteres.'))
  }

  let ticketNumber = ''

  try {
    ticketNumber = await db.transaction(async (client) => {
      const categoryResult = await client.query<{
        default_priority: string
        first_response_minutes: number
        resolution_minutes: number
      }>(
        `select default_priority, first_response_minutes, resolution_minutes
           from ticket_categories
          where id = $1 and is_active = true`,
        [categoryId]
      )
      const category = categoryResult.rows[0]
      if (!category) throw new Error('Categoria inválida.')

      const openCountResult = await client.query<{ count: number }>(
        `select count(*)::int as count
           from tickets
          where requester_id = $1
            and status in ('open', 'in_progress', 'waiting_customer')`,
        [session.userId]
      )
      if ((openCountResult.rows[0]?.count ?? 0) >= MAX_OPEN_TICKETS) {
        throw new Error('Já tens 5 pedidos de ajuda abertos. Aguarda resposta antes de abrir outro.')
      }

      const inserted = await client.query<{ id: string; number: string }>(
        `insert into tickets(
           requester_id, category_id, subject, description, priority,
           first_response_due, resolution_due
         )
         values (
           $1, $2, $3, $4, $5::ticket_priority,
           now() + make_interval(mins => $6::int),
           now() + make_interval(mins => $7::int)
         )
         returning id, number`,
        [
          session.userId,
          categoryId,
          subject,
          description,
          category.default_priority,
          category.first_response_minutes,
          category.resolution_minutes,
        ]
      )

      const ticket = inserted.rows[0]
      await client.query(
        `insert into ticket_events(ticket_id, actor_id, type) values ($1, $2, 'created')`,
        [ticket.id, session.userId]
      )

      return ticket.number
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível abrir o pedido.'
    redirect('/ajuda/tickets/novo?erro=' + encodeURIComponent(message))
  }

  revalidatePath('/ajuda')
  revalidatePath('/ajuda/tickets')
  redirect(`/ajuda/tickets/${ticketNumber}?criado=1`)
}

export async function replyTicketAction(formData: FormData) {
  const session = await verifySession()
  const ticketId = normalize(formData.get('ticket_id'))
  const ticketNumber = normalize(formData.get('ticket_number'))
  const body = normalize(formData.get('body'))

  if (!ticketId) {
    redirect('/ajuda/tickets?erro=' + encodeURIComponent('Pedido inválido.'))
  }
  if (body.length < 1 || body.length > 5000) {
    redirect(
      `/ajuda/tickets/${ticketNumber}?erro=` +
        encodeURIComponent('A resposta deve ter entre 1 e 5000 caracteres.')
    )
  }

  try {
    await db.transaction(async (client) => {
      const ticketResult = await client.query<{ status: string }>(
        `select status from tickets where id = $1 and requester_id = $2 for update`,
        [ticketId, session.userId]
      )
      const ticket = ticketResult.rows[0]
      if (!ticket) throw new Error('Pedido não encontrado.')
      if (ticket.status === 'closed') throw new Error('Este pedido já foi fechado.')

      await client.query(
        `insert into ticket_messages(ticket_id, author_id, body, is_internal)
         values ($1, $2, $3, false)`,
        [ticketId, session.userId, body]
      )

      await client.query(
        `update tickets
            set status = case
                  when status in ('waiting_customer', 'resolved') then 'open'::ticket_status
                  else status
                end,
                resolved_at = case when status = 'resolved' then null else resolved_at end,
                updated_at = now()
          where id = $1`,
        [ticketId]
      )

      if (ticket.status === 'resolved') {
        await client.query(
          `insert into ticket_events(ticket_id, actor_id, type) values ($1, $2, 'reopened')`,
          [ticketId, session.userId]
        )
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível enviar a resposta.'
    redirect(`/ajuda/tickets/${ticketNumber}?erro=` + encodeURIComponent(message))
  }

  revalidatePath('/ajuda')
  revalidatePath('/ajuda/tickets')
  revalidatePath(`/ajuda/tickets/${ticketNumber}`)
  redirect(`/ajuda/tickets/${ticketNumber}?ok=1`)
}
