import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function SuperadminDashboard() {
  const session = await verifySession()
  if (session.role !== 'superadmin') redirect('/entrar')

  // Indicadores de saúde do sistema
  const statsRes = await db.query(`
    SELECT 
      (SELECT COUNT(*) FROM tickets WHERE sla_breached = true) as sla_breached_count,
      (SELECT COUNT(*) FROM payments WHERE status = 'pending' AND created_at < NOW() - INTERVAL '48 hours') as stale_payments_count,
      (SELECT COUNT(*) FROM approval_requests WHERE status = 'pending') as pending_approvals_count
  `)
  
  const stats = statsRes.rows[0]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Painel Superadmin</h1>
        <p className="text-gray-500">Visão geral do estado do sistema e alertas críticos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border-l-4 border-red-500 p-6 rounded-xl shadow-sm">
          <h2 className="text-gray-600 text-sm font-bold uppercase tracking-wider mb-2">Tickets com SLA Falhado</h2>
          <p className="text-4xl font-black text-gray-900">{stats.sla_breached_count}</p>
          <Link href="/tickets?view=sla_risk" className="text-red-600 hover:underline text-sm font-bold mt-4 inline-block">
            Ver Tickets &rarr;
          </Link>
        </div>

        <div className="bg-white border-l-4 border-yellow-500 p-6 rounded-xl shadow-sm">
          <h2 className="text-gray-600 text-sm font-bold uppercase tracking-wider mb-2">Pagamentos Pendentes {'>'} 48h</h2>
          <p className="text-4xl font-black text-gray-900">{stats.stale_payments_count}</p>
          <Link href="/pagamentos" className="text-yellow-600 hover:underline text-sm font-bold mt-4 inline-block">
            Rever Pagamentos &rarr;
          </Link>
        </div>

        <div className="bg-white border-l-4 border-blue-500 p-6 rounded-xl shadow-sm">
          <h2 className="text-gray-600 text-sm font-bold uppercase tracking-wider mb-2">Aprovações Pendentes</h2>
          <p className="text-4xl font-black text-gray-900">{stats.pending_approvals_count}</p>
          <Link href="/superadmin/aprovacoes" className="text-blue-600 hover:underline text-sm font-bold mt-4 inline-block">
            Ir para Aprovações &rarr;
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Link href="/superadmin/financeiro" className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm hover:border-blue-400 transition">
          <p className="text-2xl mb-2">💰</p>
          <p className="font-bold text-gray-900">Financeiro</p>
          <p className="text-xs text-gray-500">Entradas, saques, taxas e relatórios</p>
        </Link>
        <Link href="/superadmin/promocoes" className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm hover:border-orange-400 transition">
          <p className="text-2xl mb-2">🎁</p>
          <p className="font-bold text-gray-900">Promoções</p>
          <p className="text-xs text-gray-500">Descontos para clientes e mestres</p>
        </Link>
        <Link href="/superadmin/equipa" className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm hover:border-purple-400 transition">
          <p className="text-2xl mb-2">👥</p>
          <p className="font-bold text-gray-900">Equipa</p>
          <p className="text-xs text-gray-500">Criar contas de gestão e apoio</p>
        </Link>
        <Link href="/tickets" className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm hover:border-green-400 transition">
          <p className="text-2xl mb-2">🎧</p>
          <p className="font-bold text-gray-900">Apoio</p>
          <p className="text-xs text-gray-500">Tickets e pedidos de suporte</p>
        </Link>
      </div>

      <div className="bg-white border border-gray-200 p-8 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold mb-4">Ações Rápidas de Emergência</h2>
        <div className="flex gap-4">
          <button className="bg-red-100 text-red-700 px-6 py-3 rounded-lg font-bold hover:bg-red-200 transition">
            Ativar Modo de Manutenção
          </button>
          <button className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition">
            Congelar Todas as Carteiras
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-4">Estas ações requerem MFA no momento do clique.</p>
      </div>
    </div>
  )
}
