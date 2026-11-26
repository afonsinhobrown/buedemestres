import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { markAllNotificationsRead } from './actions'

type Row = {
  id: string
  type: string
  title: string
  body: string | null
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export default async function NotificacoesPage() {
  const session = await verifySession()
  if (!session?.userId) redirect('/entrar')

  const { rows } = await db.query<Row>(
    `select id, type, title, body, data, read_at, created_at
       from notifications
      where profile_id = $1
      order by created_at desc
      limit 100`,
    [session.userId]
  )

  const isProvider = session.role === 'provider'
  const isStaff = ['support', 'moderator', 'finance', 'admin', 'superadmin'].includes(session.role)
  const home = isProvider ? '/pro/trabalhos' : isStaff ? '/tickets' : '/painel'
  const unread = rows.filter((r) => !r.read_at).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#12163A] text-white px-5 pt-10 pb-6">
        <Link href={home} className="text-[#FFC61A] text-sm font-bold">
          ← Voltar
        </Link>
        <h1 className="text-3xl font-black mt-3">Notificações</h1>
        <p className="text-sm text-gray-300 mt-1">{unread > 0 ? `${unread} não lidas` : 'Estás em dia'}</p>
        {unread > 0 && (
          <form action={markAllNotificationsRead} className="mt-3">
            <button type="submit" className="text-[#FFC61A] text-xs font-bold">
              Marcar todas como lidas
            </button>
          </form>
        )}
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-center text-gray-400 py-16">Ainda não tens notificações.</p>
        ) : (
          rows.map((item) => {
            const data = item.data || {}
            const jobId = (data.job_id || data.jobId || data.requestId || data.request_id) as string | undefined
            const href = isProvider
              ? '/pro/trabalhos'
              : isStaff
                ? '/tickets'
                : jobId
                  ? `/pedidos/${jobId}`
                  : '/painel'
            return (
              <Link
                key={item.id}
                href={href}
                className={`block bg-white rounded-xl border p-4 shadow-sm transition-colors hover:border-[#2444C8] ${
                  item.read_at ? 'border-gray-200' : 'border-[#2444C8] bg-blue-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-[#12163A]">{item.title}</p>
                  {!item.read_at && <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />}
                </div>
                {item.body ? <p className="text-sm text-gray-600 mt-1 leading-5">{item.body}</p> : null}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(item.created_at).toLocaleString('pt-MZ', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
