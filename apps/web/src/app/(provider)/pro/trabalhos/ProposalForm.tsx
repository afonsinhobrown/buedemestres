'use client'

import { useActionState } from 'react'
import { sendPriceProposalAction, type ProposalState } from './actions'

export function ProposalForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<ProposalState | undefined, FormData>(
    sendPriceProposalAction,
    undefined
  )

  return (
    <form action={action} className="mt-3 grid gap-2 rounded-xl border border-[var(--color-zinco-200)] bg-white p-3">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="amount"
          type="number"
          min="1"
          step="1"
          required
          placeholder="Valor (MT)"
          className="h-10 flex-1 rounded-lg border border-[var(--color-zinco-200)] px-3 text-sm"
        />
        <input
          name="message"
          placeholder="Mensagem (opcional)"
          className="h-10 flex-[2] rounded-lg border border-[var(--color-zinco-200)] px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-[var(--color-cobalto)] px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? 'A enviar…' : 'Enviar orçamento'}
        </button>
      </div>
      {state?.error && <p className="text-sm text-[var(--color-oxido)]">{state.error}</p>}
      {state?.success && <p className="text-sm font-bold text-[#1E7F4F]">Orçamento enviado ao cliente.</p>}
    </form>
  )
}
