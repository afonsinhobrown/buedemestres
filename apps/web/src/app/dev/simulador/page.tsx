'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  getPendingJobs,
  getPendingRequests,
  getProviders,
  getJobById,
  createTestJob,
  acceptJob,
  rejectJob,
  acceptRequest,
  rejectRequest,
  clearOldPendingJobs
} from './actions'

export default function SimulatorPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [providers, setProviders] = useState<any[]>([])
  
  // Pedido actualmente acompanhado no "Lado Cliente"
  const [activeJob, setActiveJob] = useState<any | null>(null)
  
  // Estado do formulário de criação rápida de pedido
  const [clientName, setClientName] = useState('Afonso Teste')
  const [clientPhone, setClientPhone] = useState('841234567')
  const [problemDescription, setProblemDescription] = useState('Fuga de água grave no lava-loiças da cozinha')
  const [targetProviderId, setTargetProviderId] = useState('')
  
  // Feedback e loadings
  const [isCreating, setIsCreating] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => {
      setToastMessage(null)
    }, 4500)
  }

  // Carregar dados gerais
  const refreshData = useCallback(async () => {
    try {
      const [pendingJobs, pendingReqs, provs] = await Promise.all([
        getPendingJobs(),
        getPendingRequests(),
        getProviders()
      ])
      
      setJobs(pendingJobs)
      setRequests(pendingReqs)
      setProviders(provs)

      if (provs.length > 0 && !targetProviderId) {
        setTargetProviderId(provs[0].profile_id)
      }

      // Se temos um pedido ativo a acompanhar, atualizar o seu estado em tempo real
      if (activeJob?.id) {
        const updated = await getJobById(activeJob.id)
        if (updated) {
          setActiveJob(updated)
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar dados do simulador:', err)
    }
  }, [activeJob?.id, targetProviderId])

  useEffect(() => {
    refreshData()
    const interval = setInterval(refreshData, 2500)
    return () => clearInterval(interval)
  }, [refreshData])

  // Criar novo pedido directo de teste
  const handleCreateTestOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!targetProviderId) {
      showToast('Por favor selecione um mestre na lista.', 'error')
      return
    }

    setIsCreating(true)
    try {
      const newJob = await createTestJob({
        clientName,
        clientPhone,
        problemDescription,
        providerId: targetProviderId
      })

      if (newJob) {
        setActiveJob(newJob)
        showToast('Novo pedido criado pelo Cliente! A tocar no telemóvel do Mestre...', 'info')
        await refreshData()
      }
    } catch (err) {
      console.error(err)
      showToast('Erro ao criar pedido de teste.', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  // Aceitar pedido pelo Mestre
  const handleAcceptJob = async (id: string) => {
    setActionLoadingId(id)
    try {
      await acceptJob(id)
      showToast('✅ Pedido ACEITE pelo Mestre! O cliente já vê a confirmação no ecrã.', 'success')
      
      // Atualizar lista localmente e sincronizar pedido ativo
      setJobs(prev => prev.filter(j => j.id !== id))
      if (activeJob?.id === id) {
        setActiveJob((prev: any) => ({ ...prev, status: 'accepted' }))
      }
      await refreshData()
    } catch (err: any) {
      console.error(err)
      showToast('Erro ao aceitar pedido: ' + (err?.message || ''), 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Recusar pedido pelo Mestre
  const handleRejectJob = async (id: string) => {
    setActionLoadingId(id)
    try {
      await rejectJob(id)
      showToast('❌ Pedido RECUSADO pelo Mestre! O cliente já vê o aviso de indisponibilidade.', 'info')
      
      // Atualizar lista localmente e sincronizar pedido ativo
      setJobs(prev => prev.filter(j => j.id !== id))
      if (activeJob?.id === id) {
        setActiveJob((prev: any) => ({ ...prev, status: 'cancelled' }))
      }
      await refreshData()
    } catch (err: any) {
      console.error(err)
      showToast('Erro ao recusar pedido: ' + (err?.message || ''), 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Ações para urgências
  const handleAcceptReq = async (id: string) => {
    setActionLoadingId(id)
    try {
      await acceptRequest(id)
      showToast('Urgência SOS ACEITE pelo Mestre!', 'success')
      setRequests(prev => prev.filter(r => r.id !== id))
      await refreshData()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleRejectReq = async (id: string) => {
    setActionLoadingId(id)
    try {
      await rejectRequest(id)
      showToast('Urgência SOS RECUSADA pelo Mestre.', 'info')
      setRequests(prev => prev.filter(r => r.id !== id))
      await refreshData()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Limpar pedidos antigos acumulados
  const handleClearOld = async () => {
    if (!confirm('Deseja marcar todos os pedidos pendentes antigos como cancelados para limpar a fila de testes?')) return
    try {
      await clearOldPendingJobs()
      showToast('Fila de testes limpa com sucesso!', 'success')
      await refreshData()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '24px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          backgroundColor: toastMessage.type === 'error' ? '#ef4444' : toastMessage.type === 'info' ? '#0284c7' : '#16a34a',
          color: 'white',
          padding: '14px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          maxWidth: '480px'
        }}>
          <span>{toastMessage.text}</span>
          <button 
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', marginLeft: 'auto' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header com Status Bar */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>⚡</span>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Simulador Integrado: Cliente ↔ Mestre
              </h1>
              <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '12px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '999px' }}>
                Tempo Real (Live)
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
              Simule a experiência ponta a ponta: crie um pedido como <strong>Cliente</strong> e aceite ou recuse como <strong>Mestre</strong> para validar o ciclo de estados.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => refreshData()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              🔄 Atualizar
            </button>
            <button
              onClick={handleClearOld}
              style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              title="Cancela pedidos pendentes antigos para limpar a fila"
            >
              🧹 Limpar Fila Antiga
            </button>
          </div>
        </div>
      </div>

      {/* Grelha Principal: 2 Colunas (Cliente vs Mestre) */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        
        {/* ===================== COLUNA 1: LADO DO CLIENTE ===================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card: Criação de Pedido */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>📱</span>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                1. Criar Pedido de Teste (Cliente)
              </h2>
            </div>

            <form onSubmit={handleCreateTestOrder} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Escolher Mestre Alvo:
                </label>
                <select 
                  value={targetProviderId} 
                  onChange={(e) => setTargetProviderId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#f8fafc' }}
                >
                  {providers.map(p => (
                    <option key={p.profile_id} value={p.profile_id}>
                      {p.business_name} ({p.full_name})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Nome do Cliente:
                  </label>
                  <input 
                    type="text" 
                    value={clientName} 
                    onChange={e => setClientName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Telemóvel:
                  </label>
                  <input 
                    type="text" 
                    value={clientPhone} 
                    onChange={e => setClientPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Descrição do Problema / Serviço:
                </label>
                <input 
                  type="text" 
                  value={problemDescription} 
                  onChange={e => setProblemDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '14px',
                  padding: '11px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  opacity: isCreating ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px'
                }}
              >
                {isCreating ? 'A enviar pedido...' : '⚡ Disparar Pedido de Teste para o Mestre'}
              </button>
            </form>
          </div>

          {/* Card: Ecrã do Cliente ao Vivo (Job Tracker) */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📲</span>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                  2. Ecrã do Cliente (Ao Vivo)
                </h2>
              </div>
              {activeJob && (
                <span style={{ fontSize: '11px', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                  ID: {activeJob.id.substring(0, 8)}...
                </span>
              )}
            </div>

            {!activeJob ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>👆</div>
                <p style={{ fontWeight: 600, fontSize: '15px', color: '#334155' }}>Nenhum pedido selecionado para teste.</p>
                <p style={{ fontSize: '13px', margin: '4px 0 16px 0' }}>
                  Clique no botão azul acima para criar um pedido, ou clique em qualquer pedido na coluna do Mestre para inspecionar.
                </p>
                {jobs.length > 0 && (
                  <button
                    onClick={() => setActiveJob(jobs[0])}
                    style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '7px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}
                  >
                    Acompanhar primeiro pedido pendente (#{jobs[0].id.substring(0, 8)})
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Visualização Exata do Estado do Pedido */}
                <div style={{
                  border: '2px solid',
                  borderColor: activeJob.status === 'pending' ? '#93c5fd' : (activeJob.status === 'accepted' || activeJob.status === 'in_progress') ? '#86efac' : '#fca5a5',
                  backgroundColor: activeJob.status === 'pending' ? '#f0f9ff' : (activeJob.status === 'accepted' || activeJob.status === 'in_progress') ? '#f0fdf4' : '#fef2f2',
                  borderRadius: '10px',
                  padding: '24px 16px',
                  textAlign: 'center'
                }}>
                  
                  {/* ESTADO: PENDING */}
                  {activeJob.status === 'pending' && (
                    <div>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: '#dbeafe',
                        color: '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px auto'
                      }}>
                        <span style={{ fontSize: '26px', animation: 'spin 2s linear infinite' }}>⏳</span>
                      </div>
                      <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0369a1', margin: '0 0 6px 0' }}>
                        A contactar o Mestre...
                      </h3>
                      <p style={{ color: '#475569', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
                        O pedido está a tocar no telemóvel do <strong>{activeJob.provider_name || 'Mestre'}</strong>.<br/>
                        Aguarde enquanto ele aceita ou recusa o serviço.
                      </p>
                    </div>
                  )}

                  {/* ESTADO: ACCEPTED */}
                  {(activeJob.status === 'accepted' || activeJob.status === 'in_progress') && (
                    <div>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: '#dcfce7',
                        color: '#16a34a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px auto'
                      }}>
                        <span style={{ fontSize: '28px' }}>✅</span>
                      </div>
                      <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#15803d', margin: '0 0 6px 0' }}>
                        Pedido Aceite!
                      </h3>
                      <p style={{ color: '#334155', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
                        O <strong>{activeJob.provider_name || 'Mestre'}</strong> confirmou a disponibilidade e está a caminho ou entrará em contacto muito em breve!
                      </p>
                    </div>
                  )}

                  {/* ESTADO: REJECTED / CANCELLED */}
                  {(activeJob.status === 'cancelled' || activeJob.status === 'rejected') && (
                    <div>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px auto'
                      }}>
                        <span style={{ fontSize: '28px' }}>❌</span>
                      </div>
                      <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#b91c1c', margin: '0 0 6px 0' }}>
                        Pedido Recusado / Cancelado
                      </h3>
                      <p style={{ color: '#475569', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
                        De momento o Mestre <strong>{activeJob.provider_name || 'Mestre'}</strong> não tem disponibilidade para atender este pedido. O cliente pode pesquisar outro mestre na plataforma.
                      </p>
                    </div>
                  )}

                </div>

                {/* Info Card do Pedido */}
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Cliente: </span>
                      <strong style={{ color: '#0f172a' }}>{activeJob.client_name || 'Cliente'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Contacto: </span>
                      <strong style={{ color: '#0f172a' }}>{activeJob.client_phone || 'N/A'}</strong>
                    </div>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Mestre Solicitado: </span>
                    <strong style={{ color: '#0f172a' }}>{activeJob.provider_name || 'Mestre'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Problema: </span>
                    <span style={{ color: '#334155' }}>{activeJob.problem_description || 'Sem descrição'}</span>
                  </div>
                </div>

                {/* Link para página real do cliente */}
                <div style={{ textAlign: 'center', paddingTop: '6px' }}>
                  <Link 
                    href={`/pedidos/${activeJob.id}`} 
                    target="_blank"
                    style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    Abrir Ecrã Real do Cliente (/pedidos/{activeJob.id.substring(0, 8)}...) ↗
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===================== COLUNA 2: LADO DO MESTRE ===================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minHeight: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>👔</span>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                    Visão do Telemóvel do Mestre (App Pro)
                  </h2>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Recebe chamados em direto e decide aceitar ou recusar
                  </p>
                </div>
              </div>
              <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                {jobs.length} Pendente{jobs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Secção Pedidos Directos */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1d4ed8', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📫</span> Pedidos Directos ao Perfil ({jobs.length})
              </h3>

              {jobs.length === 0 ? (
                <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Nenhum pedido directo pendente no momento.</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    Crie um novo pedido no lado esquerdo (Cliente) para ver a notificação a tocar aqui!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {jobs.map((job) => {
                    const isSelected = activeJob?.id === job.id
                    const isLoading = actionLoadingId === job.id

                    return (
                      <div 
                        key={job.id} 
                        style={{
                          backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '14px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                              {job.client_name || 'Cliente'}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>
                              📞 {job.client_phone}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                            PENDENTE
                          </span>
                        </div>

                        <div style={{ fontSize: '13px', color: '#334155', marginBottom: '8px' }}>
                          <strong>Problema:</strong> {job.problem_description || 'Serviço solicitado via perfil'}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
                          <span>Mestre: <strong>{job.provider_name}</strong></span>
                          <span>ID: {job.id.substring(0, 8)}...</span>
                        </div>

                        {/* Botões de Decisão */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleRejectJob(job.id)}
                            disabled={isLoading}
                            style={{
                              flex: 1,
                              backgroundColor: '#fee2e2',
                              border: '1px solid #fca5a5',
                              color: '#b91c1c',
                              fontWeight: 700,
                              fontSize: '13px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            {isLoading ? '...' : '❌ RECUSAR'}
                          </button>

                          <button
                            onClick={() => handleAcceptJob(job.id)}
                            disabled={isLoading}
                            style={{
                              flex: 2,
                              backgroundColor: '#16a34a',
                              border: '1px solid #15803d',
                              color: 'white',
                              fontWeight: 700,
                              fontSize: '13px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            {isLoading ? '...' : '✅ ACEITAR'}
                          </button>

                          <button
                            onClick={() => setActiveJob(job)}
                            style={{
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                            title="Acompanhar no lado do cliente"
                          >
                            👁️
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Secção Urgências SOS */}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#b91c1c', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🚨</span> Urgências SOS (Botão Vermelho) ({requests.length})
              </h3>

              {requests.length === 0 ? (
                <div style={{ padding: '20px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px dashed #fecaca', textAlign: 'center', color: '#991b1b', fontSize: '13px' }}>
                  Sem pedidos de urgência pendentes.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {requests.map(req => (
                    <div key={req.id} style={{ backgroundColor: '#fff5f5', border: '1px solid #fed7d7', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#991b1b', marginBottom: '4px' }}>
                        {req.title || 'Urgência'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#4a5568', marginBottom: '10px' }}>
                        {req.description}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleRejectReq(req.id)}
                          disabled={actionLoadingId === req.id}
                          style={{ flex: 1, backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '6px', borderRadius: '4px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                        >
                          RECUSAR
                        </button>
                        <button
                          onClick={() => handleAcceptReq(req.id)}
                          disabled={actionLoadingId === req.id}
                          style={{ flex: 2, backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                        >
                          ACEITAR SOS
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  )
}
