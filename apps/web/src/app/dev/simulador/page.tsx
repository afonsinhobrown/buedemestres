'use client'

import React, { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function ProSimulator() {
  const [jobs, setJobs] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const supabase = createClientComponentClient()

  useEffect(() => {
    // Busca inicial de service_jobs (pedidos diretos)
    const fetchJobs = async () => {
      const { data } = await supabase.from('service_jobs').select('*').eq('status', 'pending').order('created_at', { ascending: false })
      if (data) setJobs(data)
    }
    
    // Busca inicial de service_requests (urgências)
    const fetchRequests = async () => {
      const { data } = await supabase.from('service_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
      if (data) setRequests(data)
    }

    fetchJobs()
    fetchRequests()

    // Escuta em tempo real
    const channel = supabase.channel('simulador')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_jobs' }, payload => {
        setJobs(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_requests' }, payload => {
        setRequests(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'service_jobs' }, payload => {
        setJobs(prev => prev.filter(j => j.id !== payload.new.id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'service_requests' }, payload => {
        setRequests(prev => prev.filter(r => r.id !== payload.new.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const aceitarJob = async (id: string) => {
    await supabase.from('service_jobs').update({ status: 'accepted' }).eq('id', id)
  }

  const aceitarRequest = async (id: string) => {
    await supabase.from('service_requests').update({ status: 'accepted' }).eq('id', id)
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
