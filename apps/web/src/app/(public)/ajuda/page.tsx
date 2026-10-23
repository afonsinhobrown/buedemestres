import Link from 'next/link'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/session'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em análise',
  waiting_customer: 'Aguarda resposta',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export const dynamic = 'force-dynamic'

export default async function CentroDeAjudaPage() {
  const session = await getOptionalSession()

  let tickets: Array<{
    id: string
    number: string
    subject: string
    status: string
    updated_at: string
  }> = []

  if (session?.userId) {
    try {
      const result = await db.query<{
        id: string
        number: string
        subject: string
        status: string
        updated_at: string
      }>(
        `select id, number, subject, status, updated_at
           from tickets
          where requester_id = $1
          order by updated_at desc
          limit 5`,
        [session.userId]
      )
      tickets = result.rows
    } catch (error) {
      console.error('Erro ao carregar pedidos de ajuda:', error)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-gray-50 p-8">
      <h1 className="mb-4 text-4xl font-bold text-gray-900">Centro de Ajuda</h1>
      <p className="mb-8 text-lg text-gray-600">Como podemos ajudar-te hoje?</p>

      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Os meus pedidos recentes</h2>
          {session?.userId && (
            <Link href="/ajuda/tickets" className="text-sm font-semibold text-blue-600 hover:underline">
              Ver todos
            </Link>
          )}
        </div>

        {!session?.userId ? (
          <div className="rounded-xl bg-gray-50 p-6 text-center">
            <p className="mb-3 text-gray-600">Entra na tua conta para consultar os teus pedidos de ajuda.</p>
            <Link
              href="/entrar?redirect=/ajuda"
              className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
            >
              Entrar
            </Link>
          </div>
        ) : tickets.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-6 text-center text-gray-500">
            Ainda não abriste nenhum pedido de ajuda.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/ajuda/tickets/${ticket.number}`}
                className="flex items-center justify-between gap-4 rounded-xl border bg-gray-50 p-4 transition hover:bg-gray-100"
              >
                <div>
                  <span className="rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">
                    TKT-{ticket.number}
                  </span>
                  <h3 className="mt-2 font-semibold text-gray-900">{ticket.subject}</h3>
                  <p className="text-sm text-gray-500">
                    Última actualização: {new Date(ticket.updated_at).toLocaleString('pt-MZ')}
                  </p>
                </div>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/ajuda/tickets/novo"
          className="flex flex-col items-center justify-center rounded-2xl bg-blue-600 p-8 text-white transition hover:bg-blue-700"
        >
          <span className="mb-4 text-4xl">💬</span>
          <span className="text-xl font-bold">Abrir Pedido de Ajuda</span>
          <span className="mt-2 text-center text-sm text-blue-100">
            Fala com a nossa equipa de suporte para resolver o teu problema.
          </span>
        </Link>
        <Link
          href="/faq"
          className="flex flex-col items-center justify-center rounded-2xl border bg-white p-8 transition hover:bg-gray-50"
        >
          <span className="mb-4 text-4xl">📚</span>
          <span className="text-xl font-bold text-gray-900">Perguntas Frequentes</span>
          <span className="mt-2 text-center text-sm text-gray-500">
            Consulta as respostas às dúvidas mais comuns.
          </span>
        </Link>
      </div>
    </div>
  )
}
