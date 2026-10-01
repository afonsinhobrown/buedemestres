import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function TicketAdminInboxPage({ searchParams }: { searchParams: { view?: string } }) {
  const session = await verifySession()
  const isStaff = ['support', 'moderator', 'finance', 'admin', 'superadmin'].includes(session.role || '')
  if (!isStaff) redirect('/entrar')

  const view = searchParams.view || 'unassigned'

  let filterSql = `WHERE t.status IN ('open', 'in_progress', 'waiting_customer')`
  let params: any[] = []

  if (view === 'unassigned') {
    filterSql += ` AND t.assigned_to IS NULL`
  } else if (view === 'mine') {
    filterSql += ` AND t.assigned_to = $1`
    params.push(session.userId)
  } else if (view === 'sla_risk') {
    filterSql += ` AND (t.sla_breached = true OR t.resolution_due < NOW() + INTERVAL '4 hours')`
  } else if (view === 'urgent') {
    filterSql += ` AND t.priority IN ('high', 'urgent')`
  } else if (view === 'waiting_customer') {
    filterSql += ` AND t.status = 'waiting_customer'`
  }

  const query = `
    SELECT 
      t.id, t.number, t.subject, t.priority, t.status, t.first_response_due, t.resolution_due, t.created_at, t.sla_breached,
      p.full_name as requester_name
    FROM tickets t
    JOIN profiles p ON p.id = t.requester_id
    ${filterSql}
    ORDER BY t.created_at ASC
  `

  const ticketsRes = await db.query(query, params)
  const tickets = ticketsRes.rows

  // Counts for sidebar
  const countsRes = await db.query(`
    SELECT 
      COUNT(*) FILTER (WHERE assigned_to IS NULL AND status != 'closed' AND status != 'resolved') as unassigned,
      COUNT(*) FILTER (WHERE assigned_to = $1 AND status != 'closed' AND status != 'resolved') as mine,
      COUNT(*) FILTER (WHERE (sla_breached = true OR resolution_due < NOW() + INTERVAL '4 hours') AND status != 'closed' AND status != 'resolved') as sla_risk,
      COUNT(*) FILTER (WHERE priority IN ('high', 'urgent') AND status != 'closed' AND status != 'resolved') as urgent,
      COUNT(*) FILTER (WHERE status = 'waiting_customer') as waiting_customer
    FROM tickets
  `, [session.userId])
  const counts = countsRes.rows[0]

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white p-6 border-b flex justify-between items-center shadow-sm z-10">
        <h1 className="text-2xl font-bold">Caixa de Entrada — Tickets</h1>
        <div className="flex gap-2">
          <input type="text" placeholder="Pesquisar TKT-..." className="p-2 border rounded-lg bg-gray-50 w-64" />
          <button className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold">Pesquisar</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar de Vistas */}
        <aside className="w-64 bg-white border-r p-4 flex flex-col gap-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Vistas</h3>
          <Link href="?view=unassigned" className={`p-3 rounded-lg font-semibold cursor-pointer ${view === 'unassigned' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}>
            📥 Não Atribuídos ({counts.unassigned})
          </Link>
          <Link href="?view=mine" className={`p-3 rounded-lg font-semibold cursor-pointer ${view === 'mine' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}>
            👤 Os meus tickets ({counts.mine})
          </Link>
          <Link href="?view=sla_risk" className={`p-3 rounded-lg font-semibold cursor-pointer ${view === 'sla_risk' ? 'bg-red-50 text-red-700' : 'hover:bg-gray-50 text-red-600'}`}>
            ⚠️ SLA em Risco ({counts.sla_risk})
          </Link>
          <Link href="?view=urgent" className={`p-3 rounded-lg font-semibold cursor-pointer ${view === 'urgent' ? 'bg-orange-50 text-orange-700' : 'hover:bg-gray-50 text-gray-700'}`}>
            🔥 Urgentes ({counts.urgent})
          </Link>
          <Link href="?view=waiting_customer" className={`p-3 rounded-lg font-semibold cursor-pointer ${view === 'waiting_customer' ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-50 text-gray-700'}`}>
            ⏳ Aguardam cliente ({counts.waiting_customer})
          </Link>
        </aside>

        {/* Lista de Tickets */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 w-24">Ticket</th>
                  <th className="p-4">Assunto</th>
                  <th className="p-4 w-32">Prioridade</th>
                  <th className="p-4 w-32">Estado</th>
                  <th className="p-4 w-40">Data Criação</th>
                  <th className="p-4 w-32">Acção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">Sem tickets nesta vista.</td>
                  </tr>
                ) : (
                  tickets.map(t => (
                    <tr key={t.id} className="hover:bg-blue-50 transition group">
                      <td className="p-4 font-mono font-bold text-gray-700">TKT-{t.number}</td>
                      <td className="p-4">
                        <Link href={`/tickets/${t.id}`} className="block">
                          <p className="font-semibold text-gray-900 truncate max-w-md">{t.subject}</p>
                          <p className="text-xs text-gray-500">{t.requester_name}</p>
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          t.priority === 'urgent' || t.priority === 'high' ? 'bg-red-100 text-red-800' : 
                          t.priority === 'normal' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                          {t.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 font-semibold">
                        {new Date(t.created_at).toLocaleString('pt-MZ')}
                      </td>
                      <td className="p-4">
                        <Link href={`/tickets/${t.id}`} className="text-blue-600 font-bold hover:underline">
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
