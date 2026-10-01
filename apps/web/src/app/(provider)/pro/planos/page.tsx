import { PageShell } from '@/components/layout/PageShell'
import { verifySession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatMT } from '@/lib/utils/format-mzn'
import { redirect } from 'next/navigation'
import { CheckCircle } from '@phosphor-icons/react/dist/ssr'
import { SubscribeButton } from './SubscribeButton'

export default async function PlanosPage() {
  const session = await verifySession()
  if (!session?.userId) return redirect('/login')

  // Obter planos
  const { rows: planos } = await db.query(
    `SELECT * FROM plans WHERE is_active = true ORDER BY sort_order ASC`
  )

  // Obter subscrição actual e saldo
  const { rows: subs } = await db.query(
    `SELECT s.plan_id, p.name as plan_name, s.ends_at
     FROM subscriptions s
     JOIN plans p ON s.plan_id = p.id
     WHERE s.provider_id = $1 AND s.status = 'active'`,
    [session.userId]
  )
  const subActual = subs[0]

  const { rows: wallets } = await db.query(
    `SELECT balance FROM wallets WHERE profile_id = $1`,
    [session.userId]
  )
  const balance = wallets[0]?.balance || 0

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        
        <header className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl display-wide text-[var(--color-tinta)] mb-3">
            Destaca-te da concorrência
          </h1>
          <p className="text-[var(--color-zinco)] max-w-lg mx-auto">
            Ganha mais clientes e aumenta os teus lucros com os planos do Bué de Mestres. 
            Tens {formatMT(balance)} na carteira.
          </p>
        </header>

        {subActual && (
          <div className="bg-[#1E7F4F]/10 border border-[#1E7F4F] rounded-[var(--radius-placa)] p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 mb-12 text-[#1E7F4F]">
            <div className="flex items-center gap-3">
              <CheckCircle size={32} weight="fill" />
              <div>
                <h3 className="font-bold uppercase tracking-wider text-sm">Plano Activo</h3>
                <p className="text-lg font-bold">{subActual.plan_name}</p>
              </div>
            </div>
            <div className="text-sm font-medium">
              Válido até: {new Date(subActual.ends_at).toLocaleDateString('pt-MZ')}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {planos.map(plano => {
            const isCurrent = subActual?.plan_id === plano.id
            const isPremium = plano.price > 0
            
            return (
              <div 
                key={plano.id} 
                className={`relative flex flex-col p-6 rounded-[var(--radius-placa)] bg-[var(--color-papel)] border-2 ${
                  isPremium ? 'border-[var(--color-cobalto)] shadow-[4px_4px_0px_var(--color-cobalto)] -translate-y-2' : 'border-[var(--color-zinco-200)]'
                }`}
              >
                {plano.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-amarelo)] text-[var(--color-tinta)] text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border-2 border-[var(--color-tinta)]">
                    {plano.badge}
                  </div>
                )}
                
                <h2 className="text-xl display-wide text-center mb-2">{plano.name}</h2>
                <div className="text-center mb-6">
                  <span className="text-3xl font-bold">{plano.price > 0 ? formatMT(plano.price) : 'Grátis'}</span>
                  {plano.price > 0 && <span className="text-sm text-[var(--color-zinco)]">/mês</span>}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-center gap-2 text-sm text-[var(--color-tinta)]">
                    <CheckCircle size={16} className="text-[#1E7F4F] shrink-0" weight="bold" />
                    Até {plano.max_services} serviços
                  </li>
                  <li className="flex items-center gap-2 text-sm text-[var(--color-tinta)]">
                    <CheckCircle size={16} className="text-[#1E7F4F] shrink-0" weight="bold" />
                    Até {plano.max_photos} fotos no portfólio
                  </li>
                  <li className="flex items-center gap-2 text-sm text-[var(--color-tinta)]">
                    <CheckCircle size={16} className="text-[#1E7F4F] shrink-0" weight="bold" />
                    {plano.max_categories} categoria(s)
                  </li>
                  <li className="flex items-center gap-2 text-sm text-[var(--color-tinta)]">
                    <CheckCircle size={16} className="text-[#1E7F4F] shrink-0" weight="bold" />
                    {plano.can_quote_unlimited ? 'Orçamentos ilimitados' : `${plano.monthly_quotes} orçamentos / mês`}
                  </li>
                  {plano.featured_days_included > 0 && (
                    <li className="flex items-center gap-2 text-sm font-bold text-[var(--color-cobalto)]">
                      <CheckCircle size={16} className="text-[var(--color-cobalto)] shrink-0" weight="bold" />
                      {plano.featured_days_included} dias em destaque!
                    </li>
                  )}
                </ul>

                <SubscribeButton 
                  planId={plano.id}
                  planName={plano.name}
                  price={plano.price}
                  isCurrent={isCurrent}
                  walletBalance={balance}
                />
              </div>
            )
          })}
        </div>

      </div>
    </PageShell>
  )
}
