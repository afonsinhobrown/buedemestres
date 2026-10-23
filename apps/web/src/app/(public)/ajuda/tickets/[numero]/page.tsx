import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/session'
import { replyTicketAction } from '../actions'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em análise',
  waiting_customer: 'Aguarda a tua resposta',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export const dynamic = 'force-dynamic'

export default async function TicketUserDetail({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>
  searchParams: Promise<{ erro?: string; ok?: string; criado?: string }>
}) {
  const { numero } = await params
  const { erro, ok, criado } = await searchParams
  const session = await getOptionalSession()

  if (!session?.userId) {
    redirect(`/entrar?redirect=/ajuda/tickets/${numero}`)
  }

  const ticketResult = await db.query<{
    id: string
    number: string
    subject: string
    description: string
    status: string
    created_at: string
  }>(
    `select id, number, subject, description, status, created_at
       from tickets
      where (number::text = $1 or id::text = $1)
        and requester_id = $2
      limit 1`,
    [numero, session.userId]
  )

  const ticket = ticketResult.rows[0]
  if (!ticket) notFound()

  const messagesResult = await db.query<{
    id: string
    body: string
    created_at: string
    author_name: string
  }>(
    `select tm.id, tm.body, tm.created_at, p.full_name as author_name
       from ticket_messages tm
       join profiles p on p.id = tm.author_id
      where tm.ticket_id = $1
        and tm.is_internal = false
      order by tm.created_at asc`,
    [ticket.id]
  )

  const isClosed = ticket.status === 'closed'

  return (
    <div className="mx-auto mt-12 min-h-screen max-w-3xl rounded-2xl border bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            TKT-{ticket.number} · {ticket.subject}
          </h1>
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-yellow-800">
            {STATUS_LABELS[ticket.status] ?? ticket.status}
          </span>
        </div>
        <Link href="/ajuda/tickets" className="text-sm font-bold text-gray-400 hover:text-gray-600">
          ← Voltar
        </Link>
      </div>

      {criado && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Pedido criado com sucesso. A equipa de apoio vai responder em breve.
        </div>
      )}
      {ok && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Resposta enviada.
        </div>
      )}
      {erro && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="mb-6 space-y-4 rounded-xl bg-gray-50 p-6">
        <div className="flex flex-col items-end">
          <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-blue-600 p-4 text-white shadow-sm">
            {ticket.description}
          </div>
          <span className="mt-2 text-xs text-gray-400">
            Tu · {new Date(ticket.created_at).toLocaleString('pt-MZ')}
          </span>
        </div>

        {messagesResult.rows.map((message) => (
          <div key={message.id} className="flex flex-col items-start">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-gray-200 bg-white p-4 text-gray-800 shadow-sm">
              {message.body}
            </div>
            <span className="mt-2 text-xs text-gray-400">
              {message.author_name} · {new Date(message.created_at).toLocaleString('pt-MZ')}
            </span>
          </div>
        ))}
      </div>

      {isClosed ? (
        <p className="rounded-xl border bg-gray-50 p-4 text-center text-sm text-gray-500">
          Este pedido está fechado. Abre um novo pedido se precisares de mais ajuda.
        </p>
      ) : (
        <form action={replyTicketAction} className="border-t pt-4">
          <input type="hidden" name="ticket_id" value={ticket.id} />
          <input type="hidden" name="ticket_number" value={ticket.number} />
          <label htmlFor="body" className="mb-2 block text-sm font-semibold">
            Responder
          </label>
          <textarea
            id="body"
            name="body"
            required
            minLength={1}
            maxLength={5000}
            className="mb-4 h-28 w-full rounded-xl border bg-gray-50 p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Escreve a tua resposta..."
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-700"
            >
              Enviar Resposta
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
