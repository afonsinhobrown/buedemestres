'use client'

import { useState } from 'react'
import { confirmPayment, rejectPayment } from './actions'
import { toast } from 'sonner'

type Payment = {
  id: string
  provider_ref: string | null
  user_name: string
  amount: number
  method: string
  msisdn: string | null
  proof_path: string | null
  created_at: string
}

export function PagamentosList({ items }: { items: Payment[] }) {
  const [selected, setSelected] = useState<Payment | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleAction(action: 'confirm' | 'reject') {
    if (!selected) return

    setIsSubmitting(true)
    const res = action === 'confirm' 
      ? await confirmPayment(selected.id)
      : await rejectPayment(selected.id)
    setIsSubmitting(false)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(action === 'confirm' ? 'Pagamento confirmado e saldo creditado!' : 'Pagamento rejeitado.')
      setSelected(null)
    }
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Sem carregamentos pendentes no momento.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 text-sm font-semibold text-gray-700">Utilizador</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Data</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Método / Ref</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Valor (MT)</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Acção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-semibold text-gray-900">{item.user_name}</td>
                  <td className="p-4 text-gray-600">
                    {new Date(item.created_at).toLocaleString('pt-MZ')}
                  </td>
                  <td className="p-4">
                    <span className="uppercase text-xs font-bold bg-gray-200 px-2 py-1 rounded">{item.method}</span>
                    {item.provider_ref && <div className="text-xs text-gray-500 mt-1">Ref: {item.provider_ref}</div>}
                    {item.msisdn && <div className="text-xs text-gray-500 mt-1">Tel: {item.msisdn}</div>}
                  </td>
                  <td className="p-4 font-bold text-blue-600">
                    {Number(item.amount).toFixed(2)} MT
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => setSelected(item)}
                      className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
                    >
                      Analisar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Analisar Pagamento</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <p className="text-sm text-gray-500">Utilizador</p>
                <p className="font-bold text-lg">{selected.user_name}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Valor Solicitado</p>
                  <p className="font-bold text-blue-600 text-xl">{Number(selected.amount).toFixed(2)} MT</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Método</p>
                  <p className="font-bold uppercase">{selected.method}</p>
                </div>
              </div>

              {selected.proof_path && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Comprovativo</p>
                  <div className="bg-gray-100 p-2 rounded-lg text-center">
                    <a href={selected.proof_path} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">
                      Abrir Comprovativo em Nova Aba
                    </a>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => handleAction('reject')}
                  disabled={isSubmitting}
                  className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-3 rounded-lg font-bold transition disabled:opacity-50"
                >
                  Rejeitar Falho
                </button>
                <button 
                  onClick={() => handleAction('confirm')}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-md transition disabled:opacity-50"
                >
                  Confirmar Saldo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
