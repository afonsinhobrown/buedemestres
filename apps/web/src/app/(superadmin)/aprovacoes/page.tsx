import { db } from '@/lib/db'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { AprovacoesClient } from './AprovacoesClient'
import { Toaster } from 'sonner'

export default async function AprovacoesPage() {
  const session = await verifySession()
  if (session.role !== 'superadmin' && session.role !== 'finance') redirect('/entrar')

  const aprovacoesRes = await db.query(`
    SELECT 
      a.id, a.action_type, a.payload, a.reason, a.status, a.created_at,
      p.full_name as requester_name
    FROM approval_requests a
    JOIN profiles p ON p.id = a.requested_by
    WHERE a.status = 'pending'
    ORDER BY a.created_at ASC
  `)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Toaster position="top-right" richColors />
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Aprovações Pendentes</h1>
          <p className="text-gray-500">Dupla aprovação exigida para acções sensíveis financeiras.</p>
        </div>
      </div>

      <AprovacoesClient items={aprovacoesRes.rows as any} currentUserId={session.userId} />
    </div>
  )
}
