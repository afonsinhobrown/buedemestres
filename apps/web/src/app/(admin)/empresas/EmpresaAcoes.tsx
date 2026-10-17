'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { setCompanyVerification } from './actions'

export function EmpresaAcoes({ companyId }: { companyId: string }) {
  const [sending, setSending] = useState(false)

  async function setStatus(status: 'approved' | 'rejected' | 'pending') {
    setSending(true)
    const res = await setCompanyVerification(companyId, status)
    setSending(false)
    if (res.error) toast.error(res.error)
    else toast.success('Estado da empresa atualizado.')
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setStatus('rejected')}
        disabled={sending}
        className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
      >
        Rejeitar
      </button>
      <button
        onClick={() => setStatus('approved')}
        disabled={sending}
        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
      >
        Aprovar
      </button>
    </div>
  )
}
