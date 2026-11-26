import { PageShell } from '@/components/layout/PageShell'
import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Plus, Clock, CheckCircle } from '@phosphor-icons/react/dist/ssr'

export default async function PedidosPage() {
  const session = await verifySession()
  
  let pedidos: any[] = []
  if (session?.userId) {
    const { rows } = await db.query(
      `SELECT r.*, c.name as category_name
       FROM service_requests r
       JOIN categories c ON r.category_id = c.id
       WHERE r.client_id = $1
       ORDER BY r.created_at DESC`,
      [session.userId]
    )
    pedidos = rows
  }

  // Fallback para design caso não esteja autenticado para visualização
  if (!session?.userId) {
    pedidos = [
      { id: '1', title: 'Motor do carro não liga', status: 'open', created_at: new Date().toISOString(), category_name: 'Automóvel' },
      { id: '2', title: 'Fuga de água na cozinha', status: 'completed', created_at: new Date(Date.now() - 86400000).toISOString(), category_name: 'Casa e Limpeza' }
    ]
  }

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto p-4 md:p-8 pb-24">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl display-wide">Meus Pedidos</h1>
          <Link 
            href="/pedidos/novo"
            className="flex items-center gap-2 bg-[var(--color-cobalto)] text-white px-4 py-2 rounded-full font-bold hover:bg-[var(--color-cobalto)]/90"
          >
            <Plus size={20} weight="bold" /> Novo
          </Link>
        </header>

        {pedidos.length === 0 ? (
          <div className="text-center py-12 bg-[var(--color-papel)] rounded-[var(--radius-placa)] border border-[var(--color-zinco-200)]">
            <p className="text-[var(--color-zinco)]">Ainda não tens nenhum pedido.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pedidos.map(pedido => (
              <Link key={pedido.id} href={`/pedidos/${pedido.id}`} className="block">
                <div className="bg-[var(--color-papel)] border border-[var(--color-zinco-200)] p-4 rounded-[var(--radius-controlo)] hover:border-[var(--color-cobalto)] transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-[var(--color-zinco)] uppercase tracking-wider">
                      {pedido.category_name}
                    </span>
                    <span className="text-xs text-[var(--color-zinco)]">
                      {new Date(pedido.created_at).toLocaleDateString('pt-MZ')}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-lg text-[var(--color-tinta)] mb-3">{pedido.title}</h3>
                  
                  <div className="flex items-center gap-2">
                    {pedido.status === 'open' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-amarelo)] bg-[var(--color-amarelo)]/10 px-2 py-1 rounded-md border border-[var(--color-amarelo)]">
                        <Clock size={14} /> Aguardando orçamentos
                      </span>
                    )}
                    {pedido.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#1E7F4F] bg-[#1E7F4F]/10 px-2 py-1 rounded-md border border-[#1E7F4F]">
                        <CheckCircle size={14} /> Concluído
                      </span>
                    )}
                    {pedido.status !== 'open' && pedido.status !== 'completed' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-zinco)] bg-[var(--color-cal)] px-2 py-1 rounded-md border border-[var(--color-zinco-200)]">
                        {pedido.status}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}
