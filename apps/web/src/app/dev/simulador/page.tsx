'use client'

import React, { useState, useEffect } from 'react'
import { getPendingJobs, getPendingRequests, acceptJob, rejectJob, acceptRequest, rejectRequest } from './actions'

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

  const recusarJob = async (id: string) => {
    try {
      await rejectJob(id)
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

  const recusarRequest = async (id: string) => {
    try {
      await rejectRequest(id)
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '850px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Simulador do Telemóvel do Mestre (Testes)</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        Este ecrã simula o que o Mestre vê na sua aplicação móvel. Permite aceitar ou recusar pedidos pendentes em tempo real.
      </p>

      <div style={{ display: 'flex', gap: '32px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#b91c1c' }}>🚨 Urgências (Botão Vermelho)</h2>
          {requests.length === 0 ? <p style={{ color: '#999' }}>Sem urgências pendentes.</p> : requests.map(req => (
            <div key={req.id} style={{ backgroundColor: '#fee2e2', padding: '16px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #fca5a5' }}>
              <p><strong>Problema:</strong> {req.description || req.title}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button 
                  onClick={() => recusarRequest(req.id)}
                  style={{ backgroundColor: '#ef4444', color: 'white', padding: '8px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}
                >
                  RECUSAR
                </button>
                <button 
                  onClick={() => aceitarRequest(req.id)}
                  style={{ backgroundColor: '#22c55e', color: 'white', padding: '8px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', flex: 2 }}
                >
                  ACEITAR
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#1d4ed8' }}>👔 Pedidos Directos (Perfil)</h2>
          {jobs.length === 0 ? <p style={{ color: '#999' }}>Sem pedidos directos pendentes.</p> : jobs.map(job => (
            <div key={job.id} style={{ backgroundColor: '#dbeafe', padding: '16px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #93c5fd' }}>
              <p><strong>Status:</strong> {job.status}</p>
              <p><strong>Mestre ID:</strong> {job.provider_id.substring(0, 8)}...</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button 
                  onClick={() => recusarJob(job.id)}
                  style={{ backgroundColor: '#ef4444', color: 'white', padding: '8px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}
                >
                  RECUSAR
                </button>
                <button 
                  onClick={() => aceitarJob(job.id)}
                  style={{ backgroundColor: '#22c55e', color: 'white', padding: '8px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', flex: 2 }}
                >
                  ACEITAR
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
