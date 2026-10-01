'use client'

import { useState } from 'react'
import { reviewVerification } from './actions'
import { toast } from 'sonner'

type Verification = {
  id: string
  provider_name: string
  doc_type: string
  doc_number: string | null
  front_path: string
  back_path: string | null
  selfie_path: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export function VerificacoesList({ items }: { items: Verification[] }) {
  const [selected, setSelected] = useState<Verification | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleAction(action: 'approve' | 'reject') {
    if (!selected) return
    if (action === 'reject' && !rejectReason.trim()) {
      toast.error('Informe o motivo da rejeição.')
      return
    }

    setIsSubmitting(true)
    const res = await reviewVerification(selected.id, action, rejectReason)
    setIsSubmitting(false)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(action === 'approve' ? 'Mestre aprovado!' : 'Verificação rejeitada.')
      setSelected(null)
      setRejectReason('')
    }
  }

  function getSLA(createdAt: string) {
    const diffHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
    const remaining = 48 - diffHours
    if (remaining < 0) return <span className="text-red-600 font-bold">Em Atraso</span>
    if (remaining < 12) return <span className="text-orange-600 font-bold">{Math.floor(remaining)}h restantes</span>
    return <span className="text-green-600 font-bold">{Math.floor(remaining)}h restantes</span>
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Não há verificações pendentes. Óptimo trabalho!
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 text-sm font-semibold text-gray-700">Mestre</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Documento</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Submissão</th>
                <th className="p-4 text-sm font-semibold text-gray-700">SLA</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Acção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-semibold text-gray-900">{item.provider_name}</td>
                  <td className="p-4 text-gray-700">
                    <span className="uppercase bg-gray-200 px-2 py-1 rounded text-xs font-bold">{item.doc_type}</span>
                    <div className="text-xs text-gray-500 mt-1">{item.doc_number || 'Sem N.º'}</div>
                  </td>
                  <td className="p-4 text-gray-600">
                    {new Date(item.created_at).toLocaleString('pt-MZ')}
                  </td>
                  <td className="p-4">{getSLA(item.created_at)}</td>
                  <td className="p-4">
                    <button 
                      onClick={() => setSelected(item)}
                      className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
                    >
                      Rever Documentos
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
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Revisão de Identidade - {selected.provider_name}</h2>
              <button onClick={() => { setSelected(null); setRejectReason(''); }} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase">Documento ({selected.doc_type})</h3>
                {/* Num projeto real, usar URLs assinadas. Aqui presumimos que os paths são URLs públicos ou gerados no server */}
                <div className="bg-gray-100 rounded-lg h-64 mb-4 flex items-center justify-center border border-gray-200 overflow-hidden">
                  <img src={selected.front_path} alt="Documento Frente" className="max-h-full object-contain" />
                </div>
                {selected.back_path && (
                  <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center border border-gray-200 overflow-hidden">
                    <img src={selected.back_path} alt="Documento Verso" className="max-h-full object-contain" />
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase">Prova de Vida (Selfie)</h3>
                <div className="bg-gray-100 rounded-lg h-64 mb-6 flex items-center justify-center border border-gray-200 overflow-hidden">
                  <img src={selected.selfie_path} alt="Selfie" className="max-h-full object-contain" />
                </div>

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6">
                  <h4 className="font-bold text-blue-900 mb-1">Checklist de Revisão:</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc pl-5">
                    <li>O documento está nítido e legível?</li>
                    <li>É um documento válido e não caducado?</li>
                    <li>A pessoa na selfie corresponde à foto do documento?</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Motivo da rejeição (apenas se for rejeitar)" 
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAction('reject')}
                      disabled={isSubmitting}
                      className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-3 rounded-lg font-bold transition disabled:opacity-50"
                    >
                      Rejeitar
                    </button>
                    <button 
                      onClick={() => handleAction('approve')}
                      disabled={isSubmitting}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-md transition disabled:opacity-50"
                    >
                      Aprovar Perfil
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
