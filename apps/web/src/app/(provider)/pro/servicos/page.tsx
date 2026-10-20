import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { ServicosList } from './ServicosList'
import { Toaster } from 'sonner'

export default async function ServicosPrecosPage() {
  const session = await verifySession()

  const servicesRes = await db.query(`
    SELECT 
      ps.id, ps.title, ps.price_type, ps.price_min, ps.is_active,
      c.name as category_name
    FROM provider_services ps
    LEFT JOIN categories c ON c.id = ps.category_id
    WHERE ps.provider_id = $1
    ORDER BY ps.created_at DESC
  `, [session.userId])

  const categoriesRes = await db.query(`
    SELECT id, name
      FROM categories
     WHERE is_active = true
       AND (
         $2 = 'admin'
         OR id = (SELECT primary_category_id FROM provider_profiles WHERE profile_id = $1)
         OR id IN (SELECT category_id FROM provider_categories WHERE provider_id = $1)
       )
     ORDER BY name ASC
  `, [session.userId, session.role])

  return (
    <div className="p-8 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      <Toaster position="top-right" richColors />
      <ServicosList 
        services={servicesRes.rows as any} 
        categories={categoriesRes.rows as any} 
      />
    </div>
  )
}
