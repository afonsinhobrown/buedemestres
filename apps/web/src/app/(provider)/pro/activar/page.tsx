import { db } from '@/lib/db'
import ActivateProviderForm from './form'
import type { Category, District, Province } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function ActivarProviderPage() {
  // Carregar dados para os selects
  const { rows: categories } = await db.query<Category>(
    `select id, name, parent_id from categories where is_active = true order by sort_order, name`
  )
  const { rows: provinces } = await db.query<Province>(
    `select id, name from provinces order by name`
  )
  const { rows: districts } = await db.query<District>(
    `select id, province_id, name from districts order by name`
  )

  // Apenas categorias filhas (têm parent_id)
  const childCategories = categories.filter((c) => c.parent_id !== null)

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Tornar-me Profissional</h1>
          <p className="mt-2 text-sm text-gray-500">
            Crie o seu perfil e comece a receber clientes.
          </p>
        </div>
        <ActivateProviderForm
          categories={childCategories}
          provinces={provinces}
          districts={districts}
        />
      </div>
    </main>
  )
}
