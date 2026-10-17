import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { Toaster } from 'sonner'
import { DisputeResolution } from '../DisputeResolution'
import { TicketReply } from '../TicketReply'

export default async function TicketAdminDetail({ params }: { params: { numero: string } }) {
  const session = await verifySession()
  const isStaff = ['support', 'moderator', 'finance', 'admin', 'superadmin'].includes(session.role || '')
  if (!isStaff) redirect('/entrar')

  const { rows } = await db.query<{
    id: string
    number: string
    subject: string
    description: string
    status: string
    priority: string
    requester_name: string
    requester_id: string
    related_job_id: string | null
    job_status: string | null
    payment_status: string | null
    payment_amount: string | null
    addenda_total: string | null
    provider_name: string | null
  }>(
    `select t.id, t.number, t.subject, t.description, t.status, t.priority,
            p.full_name as requester_name, t.requester_id,
            t.related_job_id, j.status as job_status,
            jp.status as payment_status, jp.amount as payment_amount,
            (select sum(a.amount) from job_addenda a where a.job_id = j.id) as addenda_total,
            pp.business_name as provider_name
       from tickets t
       join profiles p on p.id = t.requester_id
       left join jobs j on j.id = t.related_job_id
       left join job_payments jp on jp.job_id = j.id
       left join provider_profiles pp on pp.profile_id = j.provider_id
      where t.number = $1::bigint or t.id::text = $1
      limit 1`,
    [params.numero]
  )
  const ticket = rows[0]
  if (!ticket) notFound()

  const messagesRes = await db.query<{
    id: string
    body: string
    is_internal: boolean
    created_at: string
    author_name: string
  }>(
    `select tm.id, tm.body, tm.is_internal, tm.created_at, p.full_name as author_name
       from ticket_messages tm
       join profiles p on p.id = tm.author_id
      where tm.ticket_id = $1
      order by tm.created_at asc`,
    [ticket.id]
  )

  const canResolve =
    Boolean(ticket.related_job_id) &&
    ['disputed', 'held'].includes(ticket.payment_status || '') &&
    !['resolved', 'closed'].includes(ticket.status)

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" richColors />
      <div className="bg-white p-4 border-b flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/tickets" className="text-gray-400 hover:text-gray-900 font-bold">
            ←
          </Link>
          <h1 className="text-xl font-bold">TKT-{ticket.number}</h1>
          <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-bold uppercase">
            {ticket.status}
          </span>
          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold uppercase">
            {ticket.priority}
          </span>
        </div>
        {canResolve && <DisputeResolution ticketNumber={String(ticket.number)} />}
      </div>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <main className="lg:col-span-2 bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4">{ticket.subject}</h2>
          <p className="text-sm text-gray-500 mb-6">
            Aberto por <strong>{ticket.requester_name}</strong>
          </p>
          <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl whitespace-pre-wrap text-gray-700">
            {ticket.description}
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="font-bold text-gray-900">Conversa</h3>
            {messagesRes.rows.length === 0 ? (
              <p className="text-sm text-gray-500">Sem mensagens ainda.</p>
            ) : (
              messagesRes.rows.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-xl p-4 border ${
                    message.is_internal
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-gray-900">
                      {message.author_name}
                      {message.is_internal ? ' · nota interna' : ''}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(message.created_at).toLocaleString('pt-MZ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.body}</p>
                </div>
              ))
            )}
          </div>
          <TicketReply ticketNumber={String(ticket.number)} />
        </main>

        <aside className="bg-white border rounded-xl p-6 shadow-sm h-fit">
          <h3 className="font-bold text-gray-900 mb-4">Contexto</h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Mestre</dt>
              <dd className="font-semibold">{ticket.provider_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Estado do trabalho</dt>
              <dd className="font-semibold">{ticket.job_status || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Pagamento retido</dt>
              <dd className="font-semibold">
                {ticket.payment_amount ? `MT ${Number(ticket.payment_amount).toFixed(2)}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Aditamentos</dt>
              <dd className="font-semibold">
                {ticket.addenda_total ? `MT ${Number(ticket.addenda_total).toFixed(2)}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Estado do pagamento</dt>
              <dd className="font-semibold uppercase">{ticket.payment_status || '—'}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  )
}
