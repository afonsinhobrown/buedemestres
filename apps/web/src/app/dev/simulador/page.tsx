'use client'

import React, { useState, useEffect } from 'react'
import { getPendingJobs, getPendingRequests, acceptJob, acceptRequest } from './actions'

export default function ProSimulator() {
  const [jobs, setJobs] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const j = await getPendingJobs()
        const r = await getPendingRequests()
        setJobs(j)
        setRequests(r)
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }

    // Busca inicial e polling a cada 3 segundos
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [])

  const aceitarJob = async (id: string) => {
    try {
      await acceptJob(id)
      setJobs(prev => prev.filter(j => j.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const aceitarRequest = async (id: string) => {
    try {
      await acceptRequest(id)
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Simulador do Telemóvel do Mestre (Testes)</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        Este ecrã simula o que o Mestre vê na sua aplicação móvel. Estão aqui listados todos os pedidos pendentes em tempo real.
      </p>

      <div style={{ display: 'flex', gap: '32px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#b91c1c' }}>🚨 Urgências (Botão Vermelho)</h2>
          {requests.length === 0 ? <p style={{ color: '#999' }}>Sem urgências pendentes.</p> : requests.map(req => (
            <div key={req.id} style={{ backgroundColor: '#fee2e2', padding: '16px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #fca5a5' }}>
              <p><strong>Problema:</strong> {req.description || req.title}</p>
              <button 
                onClick={() => aceitarRequest(req.id)}
                style={{ backgroundColor: '#22c55e', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', marginTop: '12px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
              >
                ACEITAR NO TELEMÓVEL
              </button>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#1d4ed8' }}>👔 Pedidos Directos (Perfil)</h2>
          {jobs.length === 0 ? <p style={{ color: '#999' }}>Sem pedidos directos pendentes.</p> : jobs.map(job => (
            <div key={job.id} style={{ backgroundColor: '#dbeafe', padding: '16px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #93c5fd' }}>
              <p><strong>Status:</strong> {job.status}</p>
              <p><strong>Mestre ID:</strong> {job.provider_id.substring(0, 8)}...</p>
              <button 
                onClick={() => aceitarJob(job.id)}
                style={{ backgroundColor: '#22c55e', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', marginTop: '12px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
              >
                ACEITAR NO TELEMÓVEL
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
