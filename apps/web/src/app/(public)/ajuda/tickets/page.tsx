import Link from 'next/link'
import { redirect } from 'next/navigation'
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

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const session = await getOptionalSession()

  if (!session?.userId) {
    redirect('/entrar?redirect=/ajuda/tickets')
  }

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
      order by updated_at desc`,
    [session.userId]
  )

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-gray-50 p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Os meus pedidos de ajuda</h1>
          <p className="mt-1 text-gray-500">Acompanha aqui as respostas da equipa de apoio.</p>
        </div>
        <Link
          href="/ajuda/tickets/novo"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          Novo pedido
        </Link>
      </div>

      {erro && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {result.rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="mb-4 text-gray-500">Ainda não abriste nenhum pedido de ajuda.</p>
            <Link href="/ajuda/tickets/novo" className="font-bold text-blue-600 hover:underline">
              Abrir o primeiro pedido
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {result.rows.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/ajuda/tickets/${ticket.number}`}
                  className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-gray-50"
                >
                  <div>
                    <span className="rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">
                      TKT-{ticket.number}
                    </span>
                    <h2 className="mt-2 font-semibold text-gray-900">{ticket.subject}</h2>
                    <p className="text-sm text-gray-500">
                      Actualizado em {new Date(ticket.updated_at).toLocaleString('pt-MZ')}
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                    {STATUS_LABELS[ticket.status] ?? ticket.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
