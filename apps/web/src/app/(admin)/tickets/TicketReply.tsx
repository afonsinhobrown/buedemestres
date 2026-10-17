'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { replyTicket } from './actions'

export function TicketReply({ ticketNumber }: { ticketNumber: string }) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!body.trim()) return
    setSending(true)
    const res = await replyTicket(ticketNumber, body)
    setSending(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      setBody('')
      toast.success('Resposta enviada.')
    }
  }

  return (
    <div className="mt-6 border-t pt-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Escreve a resposta ao utilizador..."
        className="w-full p-3 border rounded-lg bg-gray-50 mb-2"
      />
      <div className="flex justify-end">
        <button
          onClick={send}
          disabled={sending}
          className="bg-gray-900 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
        >
          {sending ? 'A enviar...' : 'Enviar resposta'}
        </button>
      </div>
    </div>
  )
}
