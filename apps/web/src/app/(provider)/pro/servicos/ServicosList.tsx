'use client'

import { useState } from 'react'
import { createService, deleteService, toggleServiceActive } from './actions'
import { toast } from 'sonner'

type Service = {
  id: string
  title: string
  category_name: string
  price_type: 'fixed' | 'hourly' | 'from' | 'quote'
  price_min: number | null
  is_active: boolean
}

type Props = {
  services: Service[]
  categories: { id: number; name: string }[]
}

export function ServicosList({ services, categories }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const res = await createService(formData)
    setIsSubmitting(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Serviço criado com sucesso!')
      setIsModalOpen(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem a certeza que deseja remover este serviço?')) return
    const res = await deleteService(id)
    if (res.error) toast.error(res.error)
    else toast.success('Serviço removido.')
  }

  async function handleToggle(id: string, current: boolean) {
    const res = await toggleServiceActive(id, !current)
    if (res.error) toast.error(res.error)
    else toast.success(current ? 'Serviço desativado.' : 'Serviço ativado.')
  }

  function formatPriceType(type: string, min: number | null) {
    if (type === 'quote') return 'Sob Orçamento'
    if (type === 'hourly') return `${min || 0} MT / hora`
    if (type === 'from') return `A partir de ${min || 0} MT`
    return `${min || 0} MT`
  }

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gerir Serviços e Preços</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition"
        >
          + Novo Serviço
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {services.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Ainda não adicionou nenhum serviço. Comece por adicionar o seu primeiro serviço para os clientes o encontrarem.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 text-sm font-semibold text-gray-700">Serviço</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Categoria</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Preço</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Estado</th>
                <th className="p-4 text-sm font-semibold text-gray-700">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-medium text-gray-900">{s.title}</td>
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md text-xs font-semibold">
                      {s.category_name}
                    </span>
                  </td>
                  <td className="p-4 text-gray-700 font-medium">
                    {formatPriceType(s.price_type, s.price_min)}
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => handleToggle(s.id, s.is_active)}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                    >
                      {s.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => handleDelete(s.id)}
                      className="text-red-500 hover:text-red-700 font-semibold text-sm transition"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal simples */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Novo Serviço</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Título do Serviço</label>
                <input name="title" required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Manutenção de AC" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select name="category_id" required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="">Selecione...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Preço</label>
                <select name="price_type" required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="fixed">Fixo (Valor exato)</option>
                  <option value="from">A partir de</option>
                  <option value="hourly">Por Hora</option>
                  <option value="quote">Sob Orçamento (a combinar)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Preço Base (MT)</label>
                <input type="number" name="price_min" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Opcional se for sob orçamento" />
              </div>

              <input type="hidden" name="is_active" value="true" />

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50">
                  {isSubmitting ? 'A guardar...' : 'Guardar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
