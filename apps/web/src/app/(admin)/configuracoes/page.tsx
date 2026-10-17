import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import { getSandboxSettings } from '@/lib/sandbox'
import { ConfiguracoesForm, type Plan } from './ConfiguracoesForm'

export default async function ConfiguracoesPage() {
  const session = await verifySession()
  if (!['admin', 'superadmin'].includes(session.role || '')) redirect('/entrar')

  const sandbox = await getSandboxSettings()
  const plansRes = await db.query(
    `select id, code, name, price, max_services, max_photos, weekend_priority,
            recurring_visibility, rating_boost
       from plans order by sort_order`
  )

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <Toaster position="top-right" richColors />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configurações</h1>
        <p className="text-gray-500">Modo sandbox, planos e benefícios dos mestres.</p>
      </div>
      <ConfiguracoesForm sandbox={sandbox} plans={plansRes.rows as unknown as Plan[]} />
    </div>
  )
}
