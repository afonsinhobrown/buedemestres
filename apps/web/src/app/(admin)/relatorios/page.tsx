import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function RelatoriosAdminPage({ searchParams }: { searchParams: { period?: string } }) {
  const session = await verifySession()
  if (session.role !== 'admin') redirect('/entrar')

  // Filtro de tempo (simplificado para este exemplo)
  let dateFilter = `AND created_at >= NOW() - INTERVAL '30 days'`
  if (searchParams.period === 'all') dateFilter = ''
  else if (searchParams.period === 'year') dateFilter = `AND created_at >= NOW() - INTERVAL '1 year'`

  // 1. Volume Bruto (GMV) - soma do agreed_amount dos trabalhos concluídos
  const gmvRes = await db.query(`
    SELECT COALESCE(SUM(agreed_amount), 0) as total
    FROM jobs 
    WHERE status = 'completed' ${dateFilter}
  `)
  const gmv = Number(gmvRes.rows[0]?.total || 0)

  // 2. Receita Líquida (Soma de compra de planos e destaques)
  // Como são débitos da carteira, os valores são negativos, por isso multiplicamos por -1
  const receitaRes = await db.query(`
    SELECT COALESCE(SUM(amount * -1), 0) as total
    FROM wallet_transactions
    WHERE type IN ('plan_purchase', 'boost_purchase') ${dateFilter}
  `)
  const receita = Number(receitaRes.rows[0]?.total || 0)

  // 3. Mestres Activos (que concluíram pelo menos 1 trabalho no período)
  const activosRes = await db.query(`
    SELECT COUNT(DISTINCT provider_id) as total
    FROM jobs
    WHERE status = 'completed' ${dateFilter}
  `)
  const ativos = Number(activosRes.rows[0]?.total || 0)

  // 4. Taxa de conversão (Pedidos concluídos / Pedidos totais)
  const conversionRes = await db.query(`
    SELECT 
      COUNT(*) as total_requests,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_requests
    FROM service_requests
    WHERE 1=1 ${dateFilter}
  `)
  const totalReq = Number(conversionRes.rows[0]?.total_requests || 0)
  const compReq = Number(conversionRes.rows[0]?.completed_requests || 0)
  const conversion = totalReq > 0 ? ((compReq / totalReq) * 100).toFixed(1) : 0

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen bg-gray-50">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios Financeiros & KPIs</h1>
          <p className="text-gray-500">Métricas em tempo real da plataforma.</p>
        </div>
        
        <form method="GET">
          <select 
            name="period" 
            onChange={(e) => e.target.form?.submit()} 
            defaultValue={searchParams.period || 'month'}
            className="border-gray-200 border p-3 rounded-xl bg-white shadow-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="month">Últimos 30 Dias</option>
            <option value="year">Este Ano</option>
            <option value="all">Desde o Início</option>
          </select>
        </form>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
          <h2 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">GMV (Volume Bruto)</h2>
          <p className="text-3xl font-black text-gray-900">{gmv.toLocaleString('pt-MZ')} MT</p>
          <p className="text-gray-400 text-xs mt-2">Valor transacionado em serviços</p>
        </div>
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
          <h2 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">Receita Líquida</h2>
          <p className="text-3xl font-black text-blue-600">{receita.toLocaleString('pt-MZ')} MT</p>
          <p className="text-gray-400 text-xs mt-2">Planos e destaques</p>
        </div>
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
          <h2 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">Mestres Activos</h2>
          <p className="text-3xl font-black text-gray-900">{ativos}</p>
          <p className="text-gray-400 text-xs mt-2">Com trabalhos concluídos no período</p>
        </div>
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
          <h2 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">Conversão</h2>
          <p className="text-3xl font-black text-gray-900">{conversion}%</p>
          <p className="text-gray-400 text-xs mt-2">Pedidos convertidos em trabalho</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-8 h-80 flex flex-col items-center justify-center text-gray-400 shadow-sm">
        <span className="text-4xl mb-4">📊</span>
        <p className="font-semibold text-lg text-gray-600">Gráfico de Evolução Temporária</p>
        <p className="text-sm">Os dados para o gráfico de barras podem ser integrados aqui futuramente com o Recharts.</p>
      </div>
    </div>
  )
}
