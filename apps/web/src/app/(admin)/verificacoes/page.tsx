import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { VerificacoesList } from './VerificacoesList'
import { Toaster } from 'sonner'
import { redirect } from 'next/navigation'

export default async function VerificacoesAdminPage() {
  const session = await verifySession()
  
  if (session.role !== 'admin') {
    redirect('/entrar')
  }

  const res = await db.query(`
    SELECT 
      v.id, v.doc_type, v.doc_number, v.front_path, v.back_path, v.selfie_path, v.status, v.created_at,
      p.full_name as provider_name
    FROM verification_documents v
    JOIN profiles p ON p.id = v.provider_id
    WHERE v.status = 'pending'
    ORDER BY v.created_at ASC
  `)

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <Toaster position="top-right" richColors />
      
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fila de Verificações (KYC)</h1>
          <p className="text-gray-500">Avalie os documentos submetidos pelos profissionais (SLA: 48h).</p>
        </div>
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold">
          {res.rows.length} Pendentes
        </div>
      </div>
      
      <VerificacoesList items={res.rows as any} />
    </div>
  )
}
