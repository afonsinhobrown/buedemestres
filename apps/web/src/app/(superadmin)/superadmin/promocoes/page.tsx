import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import { VoltarDashboard } from '@/components/layout/VoltarDashboard'
import { contarSegmentos } from './actions'
import { PromocaoForm } from './PromocaoForm'

export default async function PromocoesPage() {
  const session = await verifySession()
  if (!['superadmin', 'admin'].includes(session.role || '')) redirect('/entrar')

  const counts = await contarSegmentos()

  const campanhas = await db.query(
    `SELECT a.id, a.meta, a.created_at, p.full_name AS autor
       FROM audit_logs a
       LEFT JOIN profiles p ON p.id = a.actor_id
      WHERE a.action = 'send_promotion'
      ORDER BY a.created_at DESC
      LIMIT 10`
  )

  const cards = [
    { key: 'clientes_ativos', label: 'Clientes ativos' },
    { key: 'clientes_inativos', label: 'Clientes inativos' },
    { key: 'clientes_recorrentes', label: 'Clientes recorrentes' },
    { key: 'mestres_ativos', label: 'Mestres ativos' },
    { key: 'mestres_inativos', label: 'Mestres inativos' },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <Toaster position="top-right" richColors />
      <div className="mb-4"><VoltarDashboard /></div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Promoções & Descontos</h1>
        <p className="text-gray-500">Envia campanhas segmentadas para reativar clientes e premiar os mais fiéis.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {cards.map((c) => (
          <div key={c.key} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-500">{c.label}</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{counts[c.key] || 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <PromocaoForm counts={counts} />
        </div>

        <section className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Campanhas enviadas</h2>
          <div className="space-y-4">
            {campanhas.rows.map((c) => {
              const meta = c.meta || {}
              return (
                <div key={c.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <p className="font-semibold text-gray-900 text-sm">{meta.title || 'Campanha'}</p>
                  <p className="text-xs text-gray-500">
                    {meta.segment} · {meta.total ?? 0} destinatários
                    {meta.promo_code ? ` · ${meta.promo_code} (${meta.discount_pct}%)` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.autor || '—'} · {new Date(c.created_at).toLocaleString('pt-MZ')}
                  </p>
                </div>
              )
            })}
            {campanhas.rows.length === 0 && <p className="text-sm text-gray-400">Ainda não foram enviadas campanhas.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
