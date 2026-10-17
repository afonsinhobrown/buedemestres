'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { enviarPromocao } from './actions'

const SEGMENTS = [
  { value: 'clientes_ativos', label: 'Clientes ativos (pediram nos últimos 30 dias)' },
  { value: 'clientes_inativos', label: 'Clientes inativos (sem pedidos há 30 dias)' },
  { value: 'clientes_recorrentes', label: 'Clientes recorrentes (2+ pedidos)' },
  { value: 'mestres_ativos', label: 'Mestres ativos (concluíram trabalho nos últimos 30 dias)' },
  { value: 'mestres_inativos', label: 'Mestres inativos (sem trabalho concluído há 30 dias)' },
]

export function PromocaoForm({ counts }: { counts: Record<string, number> }) {
  const [sending, setSending] = useState(false)
  const [segment, setSegment] = useState('clientes_inativos')

  async function submit(formData: FormData) {
    setSending(true)
    const res = await enviarPromocao(formData)
    setSending(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(`Promoção enviada a ${res.total} utilizador(es).`)
  }

  const total = counts[segment] || 0

  return (
    <form action={submit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Segmento</label>
        <select
          name="segment"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {SEGMENTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} — {counts[s.value] || 0} destinatários
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">{total} utilizador(es) vão receber esta campanha.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Título</label>
          <input name="title" required maxLength={80} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 20% no próximo serviço" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Código promocional (opcional)</label>
          <input name="promo_code" maxLength={20} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase" placeholder="VOLTA20" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Mensagem</label>
        <textarea name="body" required rows={3} maxLength={300} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Usa o código VOLTA20 e poupa no teu próximo pedido." />
      </div>

      <div className="w-48">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Desconto (%)</label>
        <input name="discount_pct" type="number" min={1} max={100} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="20" />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={sending} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-bold">
          {sending ? 'A enviar...' : 'Enviar promoção'}
        </button>
      </div>
    </form>
  )
}
