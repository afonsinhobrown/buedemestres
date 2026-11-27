'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { grantTemporaryProviderAccess, revokeTemporaryProviderAccess } from './actions'

export type TemporaryAccessItem = {
  id: string
  full_name: string
  business_name: string
  verification: string
  temporary_access_until: string | null
  pending_docs: number
  created_at: string
}

export function TemporaryAccessList({ items }: { items: TemporaryAccessItem[] }) {
  const [days, setDays] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function grant(item: TemporaryAccessItem) {
    const value = days[item.id] ?? 7
    setBusy(item.id)
    const result = await grantTemporaryProviderAccess(item.id, value)
    setBusy(null)
    if (result.error) toast.error(result.error)
    else toast.success(`Acesso temporário de ${value} dias concedido.`)
  }

  async function revoke(item: TemporaryAccessItem) {
    setBusy(item.id)
    const result = await revokeTemporaryProviderAccess(item.id)
    setBusy(null)
    if (result.error) toast.error(result.error)
    else toast.success('Acesso temporário removido.')
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Não há mestres pendentes sem documentos.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const hasTemporary = Boolean(item.temporary_access_until)
        return (
          <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-bold text-gray-900">{item.business_name}</p>
                <p className="text-sm text-gray-500">
                  {item.full_name} · {item.pending_docs > 0 ? `${item.pending_docs} documento(s) pendente(s)` : 'sem documentos submetidos'}
                </p>
                {hasTemporary && (
                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                    Acesso temporário até {new Date(item.temporary_access_until as string).toLocaleString('pt-MZ')}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-gray-500" htmlFor={`days-${item.id}`}>
                  Dias
                </label>
                <input
                  id={`days-${item.id}`}
                  type="number"
                  min={1}
                  max={90}
                  value={days[item.id] ?? 7}
                  onChange={(event) => setDays((current) => ({ ...current, [item.id]: Number(event.target.value) }))}
                  className="h-9 w-20 rounded-lg border border-gray-300 px-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => grant(item)}
                  className="h-9 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy === item.id ? 'A guardar…' : hasTemporary ? 'Renovar acesso' : 'Dar acesso temporário'}
                </button>
                {hasTemporary && (
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => revoke(item)}
                    className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-700 disabled:opacity-60"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
