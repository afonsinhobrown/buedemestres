'use client'

import React, { useState, useEffect } from 'react'
import { checkDirectJobStatus } from './actions'
import Link from 'next/link'

const PENDING = ['pending', 'requested', 'open', 'in_negotiation']
const IN_PROGRESS = [
  'accepted',
  'scheduled',
  'price_proposed',
  'puxado',
  'price_agreed',
  'en_route',
  'arrived',
  'in_service',
  'in_progress',
  'awaiting_confirmation',
]
const FINISHED = ['completed', 'cancelled', 'expired', 'disputed']

function phaseOf(status: string): 'pending' | 'in_progress' | 'finished' {
  if (PENDING.includes(status)) return 'pending'
  if (IN_PROGRESS.includes(status)) return 'in_progress'
  return 'finished'
}

function messageFor(status: string) {
  switch (status) {
    case 'awaiting_confirmation':
      return 'O mestre terminou o serviço. Falta confirmar a conclusão para libertar o pagamento.'
    case 'en_route':
      return 'O mestre está a caminho do local combinado.'
    case 'arrived':
      return 'O mestre chegou ao local e vai iniciar o serviço.'
    case 'price_proposed':
      return 'Recebeste um orçamento do mestre. Consulta a app para responder.'
    case 'completed':
      return 'Serviço concluído e pagamento libertado ao mestre.'
    default:
      return 'O mestre confirmou o pedido e entrará em contacto contigo em breve.'
  }
}

export default function JobTracker({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<string>('pending')

  useEffect(() => {
    if (FINISHED.includes(status)) return

    let cancelled = false
    const tick = async () => {
      const currentStatus = await checkDirectJobStatus(jobId)
      if (!cancelled && currentStatus) setStatus(currentStatus)
    }

    tick()
    const interval = setInterval(tick, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [jobId, status])

  const phase = phaseOf(status)

  return (
    <div style={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginTop: '32px' }}>

      {phase === 'pending' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
             <svg style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>A contactar o Mestre...</h2>
          <p style={{ color: '#666', marginTop: '16px', lineHeight: '1.5' }}>
            O seu pedido tocou no telemóvel do Mestre.<br/>
            Aguarde que ele aceite o serviço.
          </p>
        </div>
      )}

      {phase === 'in_progress' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>

          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#047857' }}>
            {status === 'awaiting_confirmation' ? 'Serviço terminado!' : 'Pedido Aceite!'}
          </h2>
          <p style={{ color: '#666', marginTop: '16px', fontSize: '18px' }}>
            {messageFor(status)}
          </p>
        </div>
      )}

      {phase === 'finished' && status === 'completed' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>

          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#047857' }}>Serviço concluído</h2>
          <p style={{ color: '#666', marginTop: '16px', fontSize: '18px' }}>
            {messageFor(status)}
          </p>
        </div>
      )}

      {phase === 'finished' && status !== 'completed' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>

          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>
            {status === 'disputed' ? 'Disputa em análise' : 'Pedido não concluído'}
          </h2>
          <p style={{ color: '#666', marginTop: '16px', fontSize: '18px' }}>
            {status === 'disputed'
              ? 'O pagamento continua retido enquanto a equipa de apoio analisa o caso.'
              : 'Este pedido foi cancelado ou expirou. Pode tentar contactar outro mestre na plataforma.'}
          </p>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <Link href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>Voltar à página inicial</Link>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
