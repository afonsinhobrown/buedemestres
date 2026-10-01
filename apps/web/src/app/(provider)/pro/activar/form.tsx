'use client'

import { useActionState, useState } from 'react'
import { activateProviderAction } from '@/app/actions/auth'
import { fieldErrors } from '@/lib/validators/auth'
import type { ActionState } from '@/lib/validators/auth'
import type { Category, District, Province } from '@/types/database'

interface Props {
  categories: Category[]
  provinces: Province[]
  districts: District[]
}

export default function ActivateProviderForm({ categories, provinces, districts }: Props) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    activateProviderAction,
    undefined
  )
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null)
  const erros = fieldErrors(state)

  const filteredDistricts = selectedProvince
    ? districts.filter((d) => d.province_id === selectedProvince)
    : districts

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <form action={action} className="space-y-5">
        {/* Nome do negócio */}
        <div>
          <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">
            Nome do negócio / profissão
          </label>
          <input
            id="business_name"
            name="business_name"
            type="text"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Ex: João Mecânico"
          />
          {erros?.business_name && (
            <p className="mt-1 text-xs text-red-600">{erros.business_name[0]}</p>
          )}
        </div>

        {/* Telemóvel */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Telemóvel
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            placeholder="+258 82 123 4567"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {erros?.phone && (
            <p className="mt-1 text-xs text-red-600">{erros.phone[0]}</p>
          )}
        </div>

        {/* Categoria */}
        <div>
          <label htmlFor="primary_category_id" className="block text-sm font-medium text-gray-700 mb-1">
            Categoria principal
          </label>
          <select
            id="primary_category_id"
            name="primary_category_id"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Seleccionar categoria…</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {erros?.primary_category_id && (
            <p className="mt-1 text-xs text-red-600">{erros.primary_category_id[0]}</p>
          )}
        </div>

        {/* Província */}
        <div>
          <label htmlFor="province" className="block text-sm font-medium text-gray-700 mb-1">
            Província
          </label>
          <select
            id="province"
            onChange={(e) => setSelectedProvince(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Seleccionar província…</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Distrito */}
        <div>
          <label htmlFor="district_id" className="block text-sm font-medium text-gray-700 mb-1">
            Bairro / Distrito
          </label>
          <select
            id="district_id"
            name="district_id"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Seleccionar bairro…</option>
            {filteredDistricts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {erros?.district_id && (
            <p className="mt-1 text-xs text-red-600">{erros.district_id[0]}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
        >
          {pending ? 'A criar perfil…' : 'Criar perfil profissional'}
        </button>
      </form>
    </div>
  )
}
