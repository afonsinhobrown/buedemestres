import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import { getSandboxSettings } from '@/lib/sandbox'
import { getSettingsValues } from '@/lib/platform-settings'
import { ConfiguracoesForm, type Plan } from './ConfiguracoesForm'
import { TaxasForm } from './TaxasForm'
import { VoltarDashboard } from '@/components/layout/VoltarDashboard'

export default async function ConfiguracoesPage() {
  const session = await verifySession()
  if (!['admin', 'superadmin'].includes(session.role || '')) redirect('/entrar')

  const sandbox = await getSandboxSettings()
  const plansRes = await db.query(
    `select id, code, name, price, priority_hours, weekend_priority,
            recurring_visibility, rating_boost
       from plans order by sort_order`
  )
  const isSuperadmin = session.role === 'superadmin'
  const settings = isSuperadmin ? await getSettingsValues() : null

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <Toaster position="top-right" richColors />
      <div className="mb-4"><VoltarDashboard href={session.role === 'superadmin' ? '/superadmin' : '/tickets'} /></div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configurações</h1>
        <p className="text-gray-500">Taxas, regras financeiras, modo sandbox e planos.</p>
      </div>
      {settings && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Taxas e regras financeiras</h2>
          <p className="text-gray-500 mb-6">
            Valores editáveis sem deploy. Aplicam-se de imediato a comissões, multas, escrow, saques e sócios.
          </p>
          <TaxasForm values={settings} />
        </div>
      )}
      <ConfiguracoesForm sandbox={sandbox} plans={plansRes.rows as unknown as Plan[]} />
    </div>
  )
}
