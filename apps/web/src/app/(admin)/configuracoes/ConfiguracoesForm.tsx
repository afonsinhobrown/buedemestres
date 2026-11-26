'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updatePlan, updateSandbox } from './actions'

export type Plan = {
  id: number
  code: string
  name: string
  price: number
  priority_hours: { mode?: string; start?: string; end?: string } | null
  weekend_priority: boolean
  recurring_visibility: boolean
  rating_boost: number
}

export function ConfiguracoesForm({
  sandbox,
  plans,
}: {
  sandbox: { active: boolean; min: number; max: number }
  plans: Plan[]
}) {
  const [active, setActive] = useState(sandbox.active)
  const [min, setMin] = useState(String(sandbox.min))
  const [max, setMax] = useState(String(sandbox.max))
  const [saving, setSaving] = useState(false)

  async function saveSandbox() {
    setSaving(true)
    const form = new FormData()
    if (active) form.set('active', 'on')
    form.set('min', min)
    form.set('max', max)
    const res = await updateSandbox(form)
    setSaving(false)
    if (res.error) toast.error(res.error)
    else toast.success('Modo sandbox atualizado.')
  }

  async function savePlan(formData: FormData) {
    const res = await updatePlan(formData)
    if (res.error) toast.error(res.error)
    else toast.success('Plano atualizado.')
  }

  return (
    <div className="space-y-8">
      <section className="bg-white border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Modo Sandbox</h2>
        <p className="text-sm text-gray-500 mb-4">
          Quando ativo, todos os serviços são limitados ao intervalo definido (por defeito 1–10 MT).
        </p>
        <label className="flex items-center gap-3 mb-4">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-5 h-5" />
          <span className="font-semibold text-gray-800">Modo sandbox ativo</span>
        </label>
        <div className="flex gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-500">Preço mínimo (MT)</label>
            <input value={min} onChange={(e) => setMin(e.target.value)} type="number" className="block mt-1 border rounded-lg p-2" />
          </div>
          <div>
            <label className="text-sm text-gray-500">Preço máximo (MT)</label>
            <input value={max} onChange={(e) => setMax(e.target.value)} type="number" className="block mt-1 border rounded-lg p-2" />
          </div>
        </div>
        <button onClick={saveSandbox} disabled={saving} className="bg-gray-900 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50">
          Guardar sandbox
        </button>
      </section>

      <section className="bg-white border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Planos</h2>
        <div className="space-y-6">
          {plans.map((plan) => (
            <form key={plan.id} action={savePlan} className="border rounded-xl p-4">
              <input type="hidden" name="id" value={plan.id} />
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{plan.code}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <label className="text-sm text-gray-600">
                  Nome
                  <input name="name" defaultValue={plan.name} className="block w-full mt-1 border rounded-lg p-2" />
                </label>
                <label className="text-sm text-gray-600">
                  Preço
                  <input name="price" type="number" defaultValue={plan.price} className="block w-full mt-1 border rounded-lg p-2" />
                </label>
                <label className="text-sm text-gray-600">
                  Prioridade
                  <select
                    name="priority_mode"
                    defaultValue={plan.priority_hours?.mode || 'none'}
                    className="block w-full mt-1 border rounded-lg p-2"
                  >
                    <option value="none">Sem prioridade</option>
                    <option value="weekend">Fins de semana</option>
                    <option value="weekdays">Dias úteis</option>
                    <option value="always">Sempre</option>
                  </select>
                </label>
                <label className="text-sm text-gray-600">
                  Início
                  <input name="priority_start" type="time" defaultValue={plan.priority_hours?.start || '08:00'} className="block w-full mt-1 border rounded-lg p-2" />
                </label>
                <label className="text-sm text-gray-600">
                  Fim
                  <input name="priority_end" type="time" defaultValue={plan.priority_hours?.end || '20:00'} className="block w-full mt-1 border rounded-lg p-2" />
                </label>
                <label className="text-sm text-gray-600">
                  Pontuação
                  <input name="rating_boost" type="number" step="0.01" defaultValue={plan.rating_boost} className="block w-full mt-1 border rounded-lg p-2" />
                </label>
                <div className="flex flex-col gap-2 pt-5">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input name="weekend_priority" type="checkbox" defaultChecked={plan.weekend_priority} className="w-4 h-4" />
                    Fim de semana
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input name="recurring_visibility" type="checkbox" defaultChecked={plan.recurring_visibility} className="w-4 h-4" />
                    Recorrentes
                  </label>
                </div>
              </div>
              <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Guardar plano</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  )
}
