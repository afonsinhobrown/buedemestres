'use client'

import { useState } from 'react'
import { decideApproval } from './actions'
import { toast } from 'sonner'

type Approval = {
  id: string
  action_type: string
  payload: any
  reason: string
  status: string
  requester_name: string
  created_at: string
}

export function AprovacoesClient({ items, currentUserId }: { items: Approval[], currentUserId: string }) {
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null)

  async function handleAction(id: string, approve: boolean) {
    setIsSubmitting(id)
    const res = await decideApproval(id, approve)
    setIsSubmitting(null)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(approve ? 'Ação aprovada e executada!' : 'Pedido rejeitado.')
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {items.length === 0 ? (
        <div className="p-12 text-center text-gray-500">
          Não há pedidos pendentes de aprovação.
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 font-semibold text-gray-700">Data</th>
              <th className="p-4 font-semibold text-gray-700">Tipo</th>
              <th className="p-4 font-semibold text-gray-700">Detalhes</th>
              <th className="p-4 font-semibold text-gray-700">Pedido por</th>
              <th className="p-4 font-semibold text-gray-700 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="p-4 text-gray-600 font-mono text-xs">
                  {new Date(item.created_at).toLocaleString('pt-MZ')}
                </td>
                <td className="p-4 font-bold text-gray-900 uppercase">{item.action_type}</td>
                <td className="p-4">
                  <p className="font-semibold">{item.reason}</p>
                  <pre className="text-xs text-gray-500 mt-1 bg-gray-100 p-2 rounded max-w-xs overflow-x-auto">
                    {JSON.stringify(item.payload, null, 2)}
                  </pre>
                </td>
                <td className="p-4 text-gray-700">{item.requester_name}</td>
                <td className="p-4 text-right">
                  <div className="flex gap-2 justify-end">
                    <button 
                      onClick={() => handleAction(item.id, false)}
                      disabled={isSubmitting === item.id}
                      className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 disabled:opacity-50 transition"
                    >
                      Rejeitar
                    </button>
                    <button 
                      onClick={() => handleAction(item.id, true)}
                      disabled={isSubmitting === item.id}
                      className="bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition shadow-sm"
                    >
                      Aprovar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
