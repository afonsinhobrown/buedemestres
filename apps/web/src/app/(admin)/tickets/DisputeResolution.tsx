'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { resolveDispute } from './actions'

export function DisputeResolution({ ticketNumber }: { ticketNumber: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handle(action: 'release' | 'refund') {
    setIsSubmitting(true)
    const res = await resolveDispute(ticketNumber, action)
    setIsSubmitting(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(action === 'release' ? 'Pagamento libertado ao mestre.' : 'Pagamento reembolsado ao cliente.')
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handle('refund')}
        disabled={isSubmitting}
        className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
      >
        Reembolsar cliente
      </button>
      <button
        onClick={() => handle('release')}
        disabled={isSubmitting}
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
      >
        Libertar pagamento ao mestre
      </button>
    </div>
  )
}
