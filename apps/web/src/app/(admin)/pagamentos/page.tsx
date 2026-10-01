import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { PagamentosList } from './PagamentosList'
import { Toaster } from 'sonner'
import { redirect } from 'next/navigation'

export default async function PagamentosPendentesPage() {
  const session = await verifySession()
  
  if (session.role !== 'admin') {
    redirect('/entrar')
  }

  // Buscar apenas os carregamentos pendentes (modo manual ou mpesa falhado que precisa review)
  const res = await db.query(`
    SELECT 
      p.id, p.provider_ref, p.amount, p.method, p.msisdn, p.proof_path, p.created_at,
      u.full_name as user_name
    FROM payments p
    JOIN profiles u ON u.id = p.profile_id
    WHERE p.status = 'pending'
    ORDER BY p.created_at ASC
  `)

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <Toaster position="top-right" richColors />
      
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Carregamentos Pendentes</h1>
          <p className="text-gray-500">Confirme os comprovativos manuais para creditar o saldo na carteira (RPC complete_payment).</p>
        </div>
        <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg font-bold">
          {res.rows.length} Pendentes
        </div>
      </div>
      
      <PagamentosList items={res.rows as any} />
    </div>
  )
}
