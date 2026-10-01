import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { PerfilForm } from './PerfilForm'
import { Toaster } from 'sonner'

export default async function EditarPerfilPage() {
  const session = await verifySession()

  // Buscar perfil atual
  const profileRes = await db.query(`
    SELECT business_name, headline, bio, whatsapp, district_id, years_experience 
    FROM provider_profiles 
    WHERE profile_id = $1
  `, [session.userId])
  
  const initialData = profileRes.rows[0] || null

  // Buscar distritos para o dropdown
  const districtsRes = await db.query(`
    SELECT id, name FROM districts ORDER BY name ASC
  `)

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <Toaster position="top-right" richColors />
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Editar Perfil (Mestre)</h1>
          <p className="text-gray-500">
            Atualize as suas informações públicas para atrair mais clientes. 
            Mantenha o seu WhatsApp e área de atuação atualizados.
          </p>
        </div>

        <PerfilForm initialData={initialData} districts={districtsRes.rows as any} />
      </div>
    </div>
  )
}
