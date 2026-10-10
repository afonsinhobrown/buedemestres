'use client'

import React, { useState, useEffect } from 'react'
import { checkDirectJobStatus } from './actions'
import Link from 'next/link'

export default function JobTracker({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<string>('pending')

  useEffect(() => {
    if (status === 'accepted' || status === 'in_progress' || status === 'completed') return

    const interval = setInterval(async () => {
      const currentStatus = await checkDirectJobStatus(jobId)
      if (currentStatus) {
        setStatus(currentStatus)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [jobId, status])

  return (
    <div style={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginTop: '32px' }}>
      
      {status === 'pending' && (
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

      {(status === 'accepted' || status === 'in_progress') && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#047857' }}>Pedido Aceite!</h2>
          <p style={{ color: '#666', marginTop: '16px', fontSize: '18px' }}>
            O Mestre confirmou a disponibilidade e entrará em contacto consigo muito em breve para se deslocar ao local.
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
