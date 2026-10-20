'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  SETTING_FIELDS,
  SETTING_GROUPS,
  type SettingField,
  type SettingValue,
} from '@/lib/platform-settings-shared'
import { updateTaxas } from './actions'

export function TaxasForm({ values }: { values: Record<string, SettingValue> }) {
  const [saving, setSaving] = useState(false)

  async function save(formData: FormData) {
    setSaving(true)
    const res = await updateTaxas(formData)
    setSaving(false)
    if (res.error) toast.error(res.error)
    else toast.success('Taxas e regras atualizadas.')
  }

  return (
    <form action={save} className="space-y-8">
      {SETTING_GROUPS.map((group) => {
        const fields = SETTING_FIELDS.filter((f) => f.group === group.id)
        if (fields.length === 0) return null
        return (
          <section key={group.id} className="bg-white border rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{group.title}</h2>
            <p className="text-sm text-gray-500 mb-4">{group.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fields.map((field) => (
                <Field key={field.key} field={field} value={values[field.key]} />
              ))}
            </div>
          </section>
        )
      })}
      <div className="sticky bottom-4">
        <button
          disabled={saving}
          className="bg-gray-900 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50 shadow-lg"
        >
          {saving ? 'A guardar...' : 'Guardar taxas e regras'}
        </button>
      </div>
    </form>
  )
}

function Field({ field, value }: { field: SettingField; value: SettingValue }) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-start gap-3 rounded-xl border p-3">
        <input
          name={field.key}
          type="checkbox"
          defaultChecked={Boolean(value)}
          className="w-5 h-5 mt-0.5"
        />
        <span>
          <span className="block font-semibold text-gray-800">{field.label}</span>
          {field.help && <span className="block text-xs text-gray-500">{field.help}</span>}
        </span>
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <label className="text-sm text-gray-600">
        <span className="block font-semibold text-gray-800">{field.label}</span>
        <select
          name={field.key}
          defaultValue={String(value)}
          className="block w-full mt-1 border rounded-lg p-2"
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.help && <span className="block text-xs text-gray-500 mt-1">{field.help}</span>}
      </label>
    )
  }

  return (
    <label className="text-sm text-gray-600">
      <span className="block font-semibold text-gray-800">
        {field.label}
        {field.unit ? ` (${field.unit})` : ''}
      </span>
      <input
        name={field.key}
        type="number"
        defaultValue={String(value)}
        min={field.min}
        max={field.max}
        step={field.step ?? 'any'}
        className="block w-full mt-1 border rounded-lg p-2"
      />
      {field.help && <span className="block text-xs text-gray-500 mt-1">{field.help}</span>}
    </label>
  )
}
