import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { VoltarDashboard } from '@/components/layout/VoltarDashboard'

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function FinanceiroPage({ searchParams }: { searchParams: { period?: string } }) {
  const session = await verifySession()
  if (!['superadmin', 'finance', 'admin'].includes(session.role || '')) redirect('/entrar')

  const period = searchParams.period || 'month'
  const interval = period === 'year' ? '1 year' : period === 'all' ? null : '30 days'
  const jobFilter = interval ? `AND j.created_at >= NOW() - INTERVAL '${interval}'` : ''
  const payFilter = interval ? `AND created_at >= NOW() - INTERVAL '${interval}'` : ''

  const [kpis, topMestres, recentPayments, recentPayouts, recurring, inactive] = await Promise.all([
    db.query(
      `SELECT
         (SELECT COALESCE(SUM(agreed_amount), 0) FROM jobs j WHERE j.status = 'completed' ${jobFilter}) AS gmv,
         (SELECT COALESCE(SUM(amount), 0) FROM job_payments WHERE status IN ('held','released') ${payFilter}) AS servicos_pagos,
         (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed' ${payFilter}) AS carregamentos,
         (SELECT COALESCE(SUM(commission_amount), 0) FROM job_payments WHERE status IN ('held','released') ${payFilter}) AS taxas_servicos,
         (SELECT COALESCE(SUM(amount), 0) FROM platform_revenue WHERE 1=1 ${payFilter}) AS taxas_extra,
         (SELECT COALESCE(SUM(ABS(amount)), 0) FROM wallet_transactions WHERE type = 'plan_purchase' ${payFilter}) AS receita_planos,
         (SELECT COALESCE(SUM(amount), 0) FROM payouts WHERE status = 'completed' ${payFilter}) AS saques,
         (SELECT COALESCE(SUM(balance), 0) FROM wallets) AS saldo_carteiras`
    ),
    db.query(
      `SELECT p.full_name, pp.business_name,
              COUNT(*)::int AS trabalhos,
              COALESCE(SUM(j.agreed_amount), 0) AS volume,
              COALESCE(SUM(jp.commission_amount), 0) AS taxas
         FROM jobs j
         JOIN profiles p ON p.id = j.provider_id
         LEFT JOIN provider_profiles pp ON pp.profile_id = j.provider_id
         LEFT JOIN job_payments jp ON jp.job_id = j.id
        WHERE j.status = 'completed' ${jobFilter}
        GROUP BY p.id, p.full_name, pp.business_name
        ORDER BY volume DESC
        LIMIT 10`
    ),
    db.query(
      `SELECT jp.id, jp.amount, jp.status, jp.created_at, jp.commission_amount,
              c.full_name AS client_name, pr.full_name AS provider_name
         FROM job_payments jp
         LEFT JOIN profiles c ON c.id = jp.client_id
         LEFT JOIN profiles pr ON pr.id = jp.provider_id
        WHERE 1=1 ${interval ? `AND jp.created_at >= NOW() - INTERVAL '${interval}'` : ''}
        ORDER BY jp.created_at DESC
        LIMIT 10`
    ),
    db.query(
      `SELECT id, amount, status, method, msisdn, created_at
         FROM payouts
        WHERE 1=1 ${payFilter}
        ORDER BY created_at DESC
        LIMIT 10`
    ),
    db.query(
      `SELECT p.id, p.full_name, p.email,
              COUNT(r.id)::int AS pedidos,
              MAX(r.created_at) AS ultimo_pedido,
              COALESCE(SUM(CASE WHEN j.status = 'completed' THEN j.agreed_amount ELSE 0 END), 0) AS valor_gasto
         FROM profiles p
         JOIN service_requests r ON r.client_id = p.id
         LEFT JOIN jobs j ON j.request_id = r.id
        WHERE p.role = 'client'
        GROUP BY p.id, p.full_name, p.email
       HAVING COUNT(r.id) >= 2
        ORDER BY pedidos DESC
        LIMIT 10`
    ),
    db.query(
      `SELECT p.id, p.full_name, p.email,
              MAX(r.created_at) AS ultimo_pedido,
              (SELECT COUNT(*)::int FROM service_requests sr WHERE sr.client_id = p.id) AS total_pedidos
         FROM profiles p
         LEFT JOIN service_requests r ON r.client_id = p.id
        WHERE p.role = 'client'
        GROUP BY p.id, p.full_name, p.email
       HAVING MAX(r.created_at) IS NULL OR MAX(r.created_at) < NOW() - INTERVAL '30 days'
        ORDER BY ultimo_pedido ASC NULLS FIRST
        LIMIT 10`
    ),
  ])

  const k = kpis.rows[0]
  const taxas = Number(k.taxas_servicos) + Number(k.taxas_extra)

  const cards = [
    { label: 'GMV (serviços concluídos)', value: `${money(k.gmv)} MT`, tone: 'text-gray-900' },
    { label: 'Serviços pagos (escrow)', value: `${money(k.servicos_pagos)} MT`, tone: 'text-blue-700' },
    { label: 'Carregamentos confirmados', value: `${money(k.carregamentos)} MT`, tone: 'text-emerald-700' },
    { label: 'Taxas da plataforma', value: `${money(taxas)} MT`, tone: 'text-orange-600' },
    { label: 'Receita de planos', value: `${money(k.receita_planos)} MT`, tone: 'text-purple-700' },
    { label: 'Saques pagos', value: `${money(k.saques)} MT`, tone: 'text-red-600' },
    { label: 'Saldo em carteiras', value: `${money(k.saldo_carteiras)} MT`, tone: 'text-gray-900' },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-4"><VoltarDashboard href={session.role === 'superadmin' ? '/superadmin' : '/tickets'} /></div>

      <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500">Entradas, saques, taxas e comportamento de clientes e mestres.</p>
        </div>
        <form method="GET">
          <select
            name="period"
            defaultValue={period}
            onChange={(e) => e.target.form?.submit()}
            className="border-gray-200 border p-3 rounded-xl bg-white shadow-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="month">Últimos 30 dias</option>
            <option value="year">Este ano</option>
            <option value="all">Desde o início</option>
          </select>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
            <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{card.label}</h2>
            <p className={`text-2xl font-black ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Top mestres por volume</h2>
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs uppercase">
              <tr><th className="text-left py-2">Mestre</th><th className="text-right py-2">Trabalhos</th><th className="text-right py-2">Volume</th><th className="text-right py-2">Taxas</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topMestres.rows.map((m, i) => (
                <tr key={i}>
                  <td className="py-2 font-semibold text-gray-900">{m.business_name || m.full_name}</td>
                  <td className="py-2 text-right">{m.trabalhos}</td>
                  <td className="py-2 text-right">{money(m.volume)} MT</td>
                  <td className="py-2 text-right">{money(m.taxas)} MT</td>
                </tr>
              ))}
              {topMestres.rows.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400">Sem trabalhos concluídos no período.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Saques recentes</h2>
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs uppercase">
              <tr><th className="text-left py-2">Método</th><th className="text-left py-2">MSISDN</th><th className="text-right py-2">Valor</th><th className="text-right py-2">Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentPayouts.rows.map((p) => (
                <tr key={p.id}>
                  <td className="py-2">{p.method || '—'}</td>
                  <td className="py-2 text-gray-500">{p.msisdn || '—'}</td>
                  <td className="py-2 text-right font-semibold">{money(p.amount)} MT</td>
                  <td className="py-2 text-right">{p.status}</td>
                </tr>
              ))}
              {recentPayouts.rows.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400">Sem saques no período.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Clientes recorrentes</h2>
          <p className="text-xs text-gray-500 mb-4">Com 2 ou mais pedidos. Bons candidatos a promoções de fidelização.</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {recurring.rows.map((c) => (
                <tr key={c.id}>
                  <td className="py-2">
                    <p className="font-semibold text-gray-900">{c.full_name}</p>
                    <p className="text-xs text-gray-500">{c.email}</p>
                  </td>
                  <td className="py-2 text-right">{c.pedidos} pedidos</td>
                  <td className="py-2 text-right font-semibold">{money(c.valor_gasto)} MT</td>
                </tr>
              ))}
              {recurring.rows.length === 0 && <tr><td className="py-6 text-center text-gray-400">Sem clientes recorrentes ainda.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Clientes menos ativos</h2>
          <p className="text-xs text-gray-500 mb-4">Sem pedidos nos últimos 30 dias. Envia-lhes uma promoção para os reativar.</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {inactive.rows.map((c) => (
                <tr key={c.id}>
                  <td className="py-2">
                    <p className="font-semibold text-gray-900">{c.full_name}</p>
                    <p className="text-xs text-gray-500">{c.email}</p>
                  </td>
                  <td className="py-2 text-right text-xs text-gray-500">
                    {c.ultimo_pedido ? `Último: ${new Date(c.ultimo_pedido).toLocaleDateString('pt-MZ')}` : 'Nunca pediu'}
                  </td>
                  <td className="py-2 text-right">{c.total_pedidos} no total</td>
                </tr>
              ))}
              {inactive.rows.length === 0 && <tr><td className="py-6 text-center text-gray-400">Sem clientes inativos.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Pagamentos de serviços recentes</h2>
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left py-2">Cliente</th>
              <th className="text-left py-2">Mestre</th>
              <th className="text-right py-2">Valor</th>
              <th className="text-right py-2">Comissão</th>
              <th className="text-right py-2">Estado</th>
              <th className="text-right py-2">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recentPayments.rows.map((p) => (
              <tr key={p.id}>
                <td className="py-2 font-semibold text-gray-900">{p.client_name || '—'}</td>
                <td className="py-2">{p.provider_name || '—'}</td>
                <td className="py-2 text-right">{money(p.amount)} MT</td>
                <td className="py-2 text-right">{money(p.commission_amount)} MT</td>
                <td className="py-2 text-right">{p.status}</td>
                <td className="py-2 text-right text-xs text-gray-500">{new Date(p.created_at).toLocaleString('pt-MZ')}</td>
              </tr>
            ))}
            {recentPayments.rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-gray-400">Sem pagamentos no período.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}
