import { PageShell } from '@/components/layout/PageShell'
import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatMT } from '@/lib/utils/format-mzn'
import { Button } from '@/components/ui/button'
import { Wallet, Plus, ArrowUpRight, ArrowDownRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function WalletPage() {
  const session = await verifySession()
  if (!session?.userId) return redirect('/login')

  // Obter saldo
  const { rows: walletRows } = await db.query(
    `SELECT balance FROM wallets WHERE profile_id = $1`,
    [session.userId]
  )
  const balance = walletRows[0]?.balance || 0

  // Obter transacções
  const { rows: txs } = await db.query(
    `SELECT id, type, amount, description, created_at 
     FROM wallet_transactions 
     WHERE profile_id = $1 
     ORDER BY created_at DESC LIMIT 20`,
    [session.userId]
  )

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        
        {/* Cartão de Saldo */}
        <div className="bg-[var(--color-tinta)] text-[var(--color-cal)] rounded-[var(--radius-placa)] p-6 mb-8 relative overflow-hidden">
          {/* Decoração geométrica de fundo */}
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="flex items-center gap-2 mb-2 text-[var(--color-zinco-200)]">
            <Wallet size={24} />
            <h2 className="font-bold uppercase tracking-wider text-sm">A tua carteira</h2>
          </div>
          
          <div className="text-4xl md:text-5xl font-bold display-wide mb-6">
            {formatMT(balance)}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="bg-[var(--color-amarelo)] text-[var(--color-tinta)] hover:bg-[var(--color-amarelo)]/90 border-2 border-[var(--color-tinta)]" asChild>
              <Link href="/pro/carteira/carregar">
                <Plus size={20} weight="bold" className="mr-2" /> Carregar Saldo
              </Link>
            </Button>
            <Button variant="secondary" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              Ver Planos Activos
            </Button>
          </div>
        </div>

        {/* Histórico */}
        <div>
          <h3 className="font-bold text-lg mb-4 text-[var(--color-tinta)]">Movimentos Recentes</h3>
          
          {txs.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-zinco)] bg-[var(--color-papel)] rounded-[var(--radius-controlo)] border border-[var(--color-zinco-200)]">
              Sem movimentos. Carrega saldo para começar.
            </div>
          ) : (
            <div className="space-y-3">
              {txs.map(tx => {
                const isPositive = Number(tx.amount) > 0
                return (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-[var(--color-papel)] border border-[var(--color-zinco-200)] rounded-[var(--radius-controlo)]">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isPositive ? 'bg-[#1E7F4F]/10 text-[#1E7F4F]' : 'bg-[var(--color-oxido)]/10 text-[var(--color-oxido)]'
                      }`}>
                        {isPositive ? <ArrowDownRight size={20} weight="bold" /> : <ArrowUpRight size={20} weight="bold" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[var(--color-tinta)]">{tx.description}</div>
                        <div className="text-xs text-[var(--color-zinco)]">
                          {new Date(tx.created_at).toLocaleDateString('pt-MZ')} · {tx.type}
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold tabular-nums ${isPositive ? 'text-[#1E7F4F]' : 'text-[var(--color-tinta)]'}`}>
                      {isPositive ? '+' : ''}{formatMT(tx.amount)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
      </div>
    </PageShell>
  )
}
