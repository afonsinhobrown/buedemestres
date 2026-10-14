'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  getActiveJobs,
  getPendingRequests,
  getProviders,
  getJobById,
  createTestJob,
  acceptJob,
  rejectJob,
  startTravel,
  proposeQuote,
  rejectQuote,
  payQuote,
  finishWork,
  confirmAndRelease,
  openDispute,
  acceptRequest,
  rejectRequest,
  clearOldPendingJobs
} from './actions'

interface QuoteItem {
  description: string
  price: number
}

const REFERENCE_PRESETS = [
  { label: 'Xipamanine', desc: 'Bairro do Xipamanine, junto ao Mercado dos Curandeiros', lat: -25.9458, lng: 32.5594 },
  { label: 'Polana Caniço', desc: 'Polana Caniço B, paragem Petromoc da Av. Vladimir Lenine', lat: -25.9325, lng: 32.5878 },
  { label: 'Alto Maé', desc: 'Alto Maé, esquina da Av. Eduardo Mondlane com Rua da Resistência', lat: -25.9612, lng: 32.5711 },
  { label: 'Costa do Sol', desc: 'Costa do Sol, junto à bomba Galp da Estrada Marginal', lat: -25.9089, lng: 32.6244 }
]

export default function FullCycleSimulatorPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [providers, setProviders] = useState<any[]>([])
  
  // Pedido atualmente acompanhado no "Lado Cliente"
  const [activeJob, setActiveJob] = useState<any | null>(null)
  
  // Formulário do Cliente
  const [clientName, setClientName] = useState('Afonso Teste')
  const [clientPhone, setClientPhone] = useState('841234567')
  const [problemDescription, setProblemDescription] = useState('Fuga de água grave no lava-loiças da cozinha')
  const [referencePoint, setReferencePoint] = useState(REFERENCE_PRESETS[0].desc)
  const [coords, setCoords] = useState({ lat: REFERENCE_PRESETS[0].lat, lng: REFERENCE_PRESETS[0].lng })
  const [targetProviderId, setTargetProviderId] = useState('')
  
  // Linhas de orçamento do Mestre (quando em deslocação / diagnóstico)
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([
    { description: 'Diagnóstico e mão de obra', price: 800 },
    { description: 'Substituição de sifão e vedantes', price: 450 }
  ])
  
  // Estado de feedback e carregamento
  const [isCreating, setIsCreating] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'M-Pesa' | 'e-Mola'>('M-Pesa')
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast(text ? { text, type } : null)
    if (text) {
      setTimeout(() => setToast(null), 5000)
    }
  }

  // Polling em tempo real
  const refreshData = useCallback(async () => {
    try {
      const [activeJobList, pendingReqs, provs] = await Promise.all([
        getActiveJobs(),
        getPendingRequests(),
        getProviders()
      ])

      setJobs(activeJobList)
      setRequests(pendingReqs)
      setProviders(provs)

      if (provs.length > 0 && !targetProviderId) {
        setTargetProviderId(provs[0].profile_id)
      }

      if (activeJob?.id) {
        const updated = await getJobById(activeJob.id)
        if (updated) {
          setActiveJob(updated)
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar dados:', err)
    }
  }, [activeJob?.id, targetProviderId])

  useEffect(() => {
    refreshData()
    const timer = setInterval(refreshData, 2000)
    return () => clearInterval(timer)
  }, [refreshData])

  // Ações do Cliente
  const handleCreateJob = async (e?: React.FormEvent) => {
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
        referencePoint,
        lat: coords.lat,
        lng: coords.lng,
        providerId: targetProviderId
      })

      if (newJob) {
        setActiveJob(newJob)
        showToast('📍 Pedido enviado com GPS e ponto de referência! A tocar no Mestre.', 'info')
        await refreshData()
      }
    } catch (err: any) {
      showToast('Erro ao criar pedido: ' + err.message, 'error')
    } finally {
      setIsCreating(false)
    }
  }

  const handlePayQuote = async (jobId: string) => {
    setLoadingAction('pay')
    try {
      const updated = await payQuote(jobId, paymentMethod)
      setActiveJob(updated)
      showToast(`🔒 Pagamento retido em garantia (Escrow) via ${paymentMethod}! Mestre autorizado a trabalhar.`, 'success')
      await refreshData()
    } catch (err: any) {
      showToast('Erro no pagamento: ' + err.message, 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleRejectQuote = async (jobId: string) => {
    setLoadingAction('rejectQuote')
    try {
      const updated = await rejectQuote(jobId)
      setActiveJob(updated)
      showToast('Orçamento recusado. O Mestre foi informado para renegociar.', 'info')
      await refreshData()
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleConfirmAndRelease = async (jobId: string) => {
    setLoadingAction('confirmRelease')
    try {
      const updated = await confirmAndRelease(jobId)
      setActiveJob(updated)
      showToast('🎉 Serviço confirmado! Dinheiro libertado para o Mestre com sucesso.', 'success')
      await refreshData()
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleOpenDispute = async (jobId: string) => {
    setLoadingAction('dispute')
    try {
      const updated = await openDispute(jobId)
      setActiveJob(updated)
      showToast('⚠️ Disputa aberta. O valor continua retido pela moderação da plataforma.', 'error')
      await refreshData()
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  // Ações do Mestre
  const handleAcceptJob = async (jobId: string) => {
    setLoadingAction('accept_' + jobId)
    try {
      const updated = await acceptJob(jobId)
      if (activeJob?.id === jobId) setActiveJob(updated)
      showToast('✅ Mestre ACEITOU o pedido!', 'success')
      await refreshData()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleRejectJob = async (jobId: string) => {
    setLoadingAction('reject_' + jobId)
    try {
      const updated = await rejectJob(jobId)
      if (activeJob?.id === jobId) setActiveJob(updated)
      showToast('❌ Mestre RECUSOU o pedido.', 'info')
      await refreshData()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleStartTravel = async (jobId: string) => {
    setLoadingAction('travel_' + jobId)
    try {
      const updated = await startTravel(jobId)
      if (activeJob?.id === jobId) setActiveJob(updated)
      showToast('🚗 Mestre a caminho do local do cliente!', 'info')
      await refreshData()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleProposeQuote = async (jobId: string) => {
    setLoadingAction('quote_' + jobId)
    try {
      const updated = await proposeQuote(jobId, quoteItems)
      if (activeJob?.id === jobId) setActiveJob(updated)
      showToast('📋 Orçamento enviado ao Cliente! A aguardar aceitação e pagamento.', 'info')
      await refreshData()
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleFinishWork = async (jobId: string) => {
    setLoadingAction('finish_' + jobId)
    try {
      const updated = await finishWork(jobId)
      if (activeJob?.id === jobId) setActiveJob(updated)
      showToast('🏁 Trabalho marcado como concluído! A aguardar aprovação do Cliente.', 'info')
      await refreshData()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleClearOld = async () => {
    if (!confirm('Deseja limpar todos os pedidos em aberto para reiniciar o ambiente de testes?')) return
    await clearOldPendingJobs()
    setActiveJob(null)
    showToast('Ambiente reiniciado com sucesso!', 'success')
    await refreshData()
  }

  // Cálculos de orçamento
  const totalQuote = quoteItems.reduce((acc, item) => acc + (Number(item.price) || 0), 0)

  // Etapas visuais do ciclo
  const getCycleStep = (status: string) => {
    switch (status) {
      case 'pending': return 1
      case 'accepted':
      case 'em_deslocacao': return 2
      case 'negotiating': return 3
      case 'in_progress': return 4
      case 'awaiting_confirmation': return 5
      case 'completed': return 6
      default: return 0
    }
  }

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', padding: '24px 16px', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#0284c7' : '#16a34a',
          color: 'white',
          padding: '16px 22px',
          borderRadius: '10px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '520px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <span style={{ fontSize: '18px' }}>{toast.type === 'error' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
          <span style={{ fontSize: '14px', lineHeight: 1.4 }}>{toast.text}</span>
          <button 
            onClick={() => setToast(null)}
            style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', marginLeft: 'auto' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header com Status do Ciclo On-Demand */}
      <div style={{ maxWidth: '1400px', margin: '0 auto 24px auto' }}>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '24px 28px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '28px' }}>⚡</span>
              <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: 'white' }}>
                Simulador On-Demand Completo (Ciclo Real)
              </h1>
              <span style={{ backgroundColor: '#22c55e20', color: '#4ade80', border: '1px solid #22c55e50', fontSize: '12px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>
                GPS + Escrow M-Pesa + Orçamento
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, maxWidth: '820px' }}>
              Este simulador reproduz o <strong>fluxo oficial do Bué de Mestres</strong>: localização com ponto de referência, deslocação no mapa, diagnóstico e orçamento com mão de obra/peças, <strong>retenção de valor em Escrow (M-Pesa)</strong> e libertação após aprovação do cliente.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => refreshData()}
              style={{ backgroundColor: '#334155', border: '1px solid #475569', color: '#f1f5f9', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              🔄 Atualizar
            </button>
            <button
              onClick={handleClearOld}
              style={{ backgroundColor: '#451a1a', border: '1px solid #7f1d1d', color: '#fca5a5', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
              title="Cancela pedidos antigos para reiniciar"
            >
              🧹 Reiniciar Ambiente
            </button>
          </div>
        </div>

        {/* Linha do Tempo / Barra de Progresso do Ciclo */}
        {activeJob && (
          <div style={{ marginTop: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px 24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
              Ciclo do Pedido em Acompanhamento (#{activeJob.id.substring(0, 8)}... - {activeJob.provider_name})
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {[
                { num: 1, label: '1. Pedido & GPS', active: getCycleStep(activeJob.status) >= 1 },
                { num: 2, label: '2. Deslocação', active: getCycleStep(activeJob.status) >= 2 },
                { num: 3, label: '3. Orçamento', active: getCycleStep(activeJob.status) >= 3 },
                { num: 4, label: '4. Pagamento / Escrow', active: getCycleStep(activeJob.status) >= 4 },
                { num: 5, label: '5. Conclusão & MT', active: getCycleStep(activeJob.status) >= 5 }
              ].map(step => (
                <div 
                  key={step.num}
                  style={{
                    backgroundColor: step.active ? '#2563eb' : '#0f172a',
                    border: step.active ? '1px solid #60a5fa' : '1px solid #334155',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: step.active ? 'white' : '#64748b',
                    transition: 'all 0.2s'
                  }}
                >
                  {step.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid Principal: Lado Cliente (Esq) vs Lado Mestre (Dir) */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px' }}>

        {/* ======================= COLUNA CLIENTE ======================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. Criar Pedido */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
              <span style={{ fontSize: '22px' }}>📱</span>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'white', margin: 0 }}>
                  1. Enviar Pedido (App Cliente)
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                  Com GPS real e Ponto de Referência textual
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Mestre Destinatário:
                </label>
                <select 
                  value={targetProviderId} 
                  onChange={(e) => setTargetProviderId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #475569', fontSize: '14px', backgroundColor: '#0f172a', color: 'white' }}
                >
                  {providers.map(p => (
                    <option key={p.profile_id} value={p.profile_id}>
                      {p.business_name} ({p.full_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ponto de Referência e Presets de Bairros de Maputo */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#cbd5e1' }}>
                    Ponto de Referência (GPS + Bairro):
                  </label>
                  <span style={{ fontSize: '11px', color: '#38bdf8' }}>Maputo, Moçambique</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {REFERENCE_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setReferencePoint(preset.desc)
                        setCoords({ lat: preset.lat, lng: preset.lng })
                      }}
                      style={{
                        backgroundColor: referencePoint === preset.desc ? '#0284c7' : '#0f172a',
                        border: '1px solid #38bdf840',
                        color: referencePoint === preset.desc ? 'white' : '#94a3b8',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      📍 {preset.label}
                    </button>
                  ))}
                </div>

                <input 
                  type="text" 
                  value={referencePoint} 
                  onChange={e => setReferencePoint(e.target.value)}
                  placeholder="Ex: Perto do mercado Xipamanine, junto à bomba..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', fontSize: '13px', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }}
                />
              </div>

              {/* Descrição do Problema */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Descrição da Avaria / Problema:
                </label>
                <input 
                  type="text" 
                  value={problemDescription} 
                  onChange={e => setProblemDescription(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', fontSize: '13px', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                    Nome:
                  </label>
                  <input 
                    type="text" 
                    value={clientName} 
                    onChange={e => setClientName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #475569', fontSize: '13px', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                    Telemóvel:
                  </label>
                  <input 
                    type="text" 
                    value={clientPhone} 
                    onChange={e => setClientPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #475569', fontSize: '13px', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '14px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
              >
                {isCreating ? 'A enviar...' : '🚀 Enviar Pedido com Localização ao Mestre'}
              </button>
            </form>
          </div>

          {/* 2. Ecrã ao Vivo do Cliente (Monitorização e Decisão) */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>📲</span>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'white', margin: 0 }}>
                    2. Telemóvel do Cliente (Ao Vivo)
                  </h2>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                    Reage em tempo real a cada passo do mestre
                  </p>
                </div>
              </div>
              {activeJob && (
                <span style={{ fontSize: '12px', fontWeight: 800, backgroundColor: '#0f172a', border: '1px solid #334155', padding: '3px 10px', borderRadius: '6px', color: '#38bdf8' }}>
                  {activeJob.status.toUpperCase()}
                </span>
              )}
            </div>

            {!activeJob ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
                <p style={{ fontWeight: 700, fontSize: '15px', color: '#cbd5e1' }}>Nenhum pedido activo selecionado.</p>
                <p style={{ fontSize: '13px', margin: '4px 0 16px 0' }}>
                  Crie um pedido acima ou clique em qualquer trabalho da lista do Mestre para acompanhar o ciclo.
                </p>
                {jobs.length > 0 && (
                  <button
                    onClick={() => setActiveJob(jobs[0])}
                    style={{ backgroundColor: '#334155', border: '1px solid #475569', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 700, color: 'white' }}
                  >
                    Acompanhar #{jobs[0].id.substring(0, 8)} ({jobs[0].provider_name})
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* DETALHE: PONTO DE REFERÊNCIA & GPS ENVIADO */}
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Mestre Contactado:</span>
                    <strong style={{ color: '#f8fafc' }}>{activeJob.provider_name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Localização do Cliente:</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{activeJob.client_lat}, {activeJob.client_lng}</span>
                  </div>
                  <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #1e293b' }}>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '12px' }}>Ponto de Referência:</span>
                    <strong style={{ color: '#facc15' }}>📍 {activeJob.reference_point || 'Não especificado'}</strong>
                  </div>
                </div>

                {/* ETAPA 1: PENDING */}
                {activeJob.status === 'pending' && (
                  <div style={{ backgroundColor: '#0284c715', border: '2px solid #0284c7', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', margin: '0 0 8px 0' }}>
                      A contactar o Mestre...
                    </h3>
                    <p style={{ color: '#cbd5e1', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
                      O chamado está a tocar no telemóvel do <strong>{activeJob.provider_name}</strong> com o seu ponto de referência.<br/>
                      Aguarde a confirmação ou rejeição.
                    </p>
                  </div>
                )}

                {/* ETAPA 2: ACCEPTED / EM DESLOCAÇÃO */}
                {(activeJob.status === 'accepted' || activeJob.status === 'em_deslocacao') && (
                  <div style={{ backgroundColor: '#065f4620', border: '2px solid #059669', borderRadius: '12px', padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '32px' }}>🚗</span>
                      <div>
                        <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#34d399', margin: 0 }}>
                          {activeJob.status === 'accepted' ? 'Pedido Aceite! A preparar partida' : 'Mestre a Caminho do seu Local!'}
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                          Estimativa de chegada: ~15 minutos no ponto de referência
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155', fontSize: '13px', color: '#cbd5e1' }}>
                      ℹ️ <strong>Próximo passo:</strong> O Mestre chegará ao local ({activeJob.reference_point}), fará o diagnóstico da avaria e apresentará a <strong>proposta de orçamento na app</strong>.
                    </div>
                  </div>
                )}

                {/* ETAPA 3: NEGOTIATING (ORÇAMENTO RECEBIDO + ESCROW) */}
                {activeJob.status === 'negotiating' && (
                  <div style={{ backgroundColor: '#eab30815', border: '2px solid #eab308', borderRadius: '12px', padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <span style={{ fontSize: '28px' }}>📋</span>
                      <div>
                        <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#facc15', margin: 0 }}>
                          Proposta de Orçamento Recebida!
                        </h3>
                        <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>
                          O Mestre diagnosticou o problema e propôs o seguinte valor:
                        </p>
                      </div>
                    </div>

                    {/* Itens do Orçamento */}
                    <div style={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', padding: '12px', marginBottom: '14px' }}>
                      {Array.isArray(activeJob.quote_items) && activeJob.quote_items.map((item: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < activeJob.quote_items.length - 1 ? '1px dashed #334155' : 'none', fontSize: '13px' }}>
                          <span style={{ color: '#e2e8f0' }}>{item.description}</span>
                          <strong style={{ color: '#38bdf8' }}>{Number(item.price).toLocaleString('pt-MZ')} MT</strong>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', marginTop: '6px', borderTop: '2px solid #334155', fontSize: '16px' }}>
                        <span style={{ fontWeight: 800, color: 'white' }}>TOTAL DO SERVIÇO:</span>
                        <strong style={{ color: '#4ade80' }}>{Number(activeJob.quoted_price || 0).toLocaleString('pt-MZ')} MT</strong>
                      </div>
                    </div>

                    {/* Explicação de Garantia / Escrow */}
                    <div style={{ backgroundColor: '#1e3a8a30', border: '1px solid #3b82f650', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: '#bfdbfe', lineHeight: 1.5 }}>
                      🛡️ <strong>Como funciona a Proteção Escrow:</strong> Ao pagar agora, os <strong>{Number(activeJob.quoted_price || 0).toLocaleString('pt-MZ')} MT</strong> NÃO vão para o Mestre. Ficam <strong>retidos e guardados com segurança na plataforma</strong>. O dinheiro só é libertado quando confirmar que o serviço foi bem executado!
                    </div>

                    {/* Seleção de Método e Pagamento */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('M-Pesa')}
                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: paymentMethod === 'M-Pesa' ? '2px solid #ef4444' : '1px solid #475569', backgroundColor: paymentMethod === 'M-Pesa' ? '#ef444420' : '#0f172a', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                      >
                        🔴 Carteira M-Pesa
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('e-Mola')}
                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: paymentMethod === 'e-Mola' ? '2px solid #eab308' : '1px solid #475569', backgroundColor: paymentMethod === 'e-Mola' ? '#eab30820' : '#0f172a', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                      >
                        🟡 Carteira e-Mola
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handleRejectQuote(activeJob.id)}
                        disabled={loadingAction === 'rejectQuote'}
                        style={{ flex: 1, backgroundColor: '#334155', border: '1px solid #475569', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        Recusar Orçamento
                      </button>

                      <button
                        onClick={() => handlePayQuote(activeJob.id)}
                        disabled={loadingAction === 'pay'}
                        style={{ flex: 2, backgroundColor: '#16a34a', border: '1px solid #22c55e', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.4)' }}
                      >
                        {loadingAction === 'pay' ? 'A processar retenção...' : `🔒 Pagar e Reter em Garantia (${paymentMethod})`}
                      </button>
                    </div>
                  </div>
                )}

                {/* ETAPA 4: IN_PROGRESS (VALOR RETIDO EM ESCROW) */}
                {activeJob.status === 'in_progress' && (
                  <div style={{ backgroundColor: '#2563eb15', border: '2px solid #3b82f6', borderRadius: '12px', padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <span style={{ fontSize: '32px' }}>🔒</span>
                      <div>
                        <div style={{ display: 'inline-block', backgroundColor: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, marginBottom: '4px' }}>
                          PAGAMENTO SEGURO RETIDO (ESCROW)
                        </div>
                        <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#60a5fa', margin: 0 }}>
                          Trabalho em Execução
                        </h3>
                      </div>
                    </div>

                    <p style={{ color: '#cbd5e1', fontSize: '14px', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                      O valor de <strong>{Number(activeJob.quoted_price || 0).toLocaleString('pt-MZ')} MT</strong> está retido com segurança na plataforma. O Mestre está a executar a reparação com a garantia de que o pagamento existe.
                    </p>

                    <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#94a3b8' }}>
                      ⏳ Aguarde que o Mestre finalize o serviço no telemóvel dele para inspecionar e aprovar a libertação.
                    </div>
                  </div>
                )}

                {/* ETAPA 5: AWAITING_CONFIRMATION (MESTRE CONCLUIU, CLIENTE APROVA E LIBERTA) */}
                {activeJob.status === 'awaiting_confirmation' && (
                  <div style={{ backgroundColor: '#05966915', border: '2px solid #10b981', borderRadius: '12px', padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '32px' }}>🏁</span>
                      <div>
                        <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#34d399', margin: 0 }}>
                          O Mestre marcou o Serviço como Concluído!
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>
                          Inspecione se o trabalho ficou bem feito antes de aprovar a libertação do valor retido.
                        </p>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                        <span style={{ color: '#94a3b8' }}>Valor Retido a Libertar:</span>
                        <strong style={{ color: '#4ade80' }}>{Number(activeJob.quoted_price || 0).toLocaleString('pt-MZ')} MT</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                        <span>Comissão da Plataforma (10%):</span>
                        <span>{Number(activeJob.commission_amount || 0).toLocaleString('pt-MZ')} MT</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handleOpenDispute(activeJob.id)}
                        disabled={loadingAction === 'dispute'}
                        style={{ flex: 1, backgroundColor: '#334155', border: '1px solid #dc2626', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        ⚠️ Não Ficou Bom (Disputar)
                      </button>

                      <button
                        onClick={() => handleConfirmAndRelease(activeJob.id)}
                        disabled={loadingAction === 'confirmRelease'}
                        style={{ flex: 2, backgroundColor: '#16a34a', border: '1px solid #22c55e', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)' }}
                      >
                        {loadingAction === 'confirmRelease' ? 'A libertar fundos...' : '🎉 Confirmar Serviço & Libertar Pagamento'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ETAPA 6: COMPLETED */}
                {activeJob.status === 'completed' && (
                  <div style={{ backgroundColor: '#10b98120', border: '2px solid #10b981', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏆</div>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#34d399', margin: '0 0 6px 0' }}>
                      Ciclo Concluído com Sucesso!
                    </h3>
                    <p style={{ color: '#e2e8f0', fontSize: '14px', margin: '0 0 16px 0' }}>
                      O serviço foi inspecionado, aprovado e o pagamento foi <strong>libertado para o Mestre ({activeJob.provider_name})</strong>.
                    </p>
                    
                    <div style={{ display: 'inline-block', backgroundColor: '#0f172a', padding: '10px 20px', borderRadius: '8px', border: '1px solid #334155', fontSize: '13px' }}>
                      <span>Recibo: Total MT {Number(activeJob.quoted_price || 0).toLocaleString('pt-MZ')} • Método: {activeJob.payment_method || 'M-Pesa'}</span>
                    </div>
                  </div>
                )}

                {/* CANCELLED */}
                {(activeJob.status === 'cancelled' || activeJob.status === 'rejected') && (
                  <div style={{ backgroundColor: '#ef444415', border: '2px solid #ef4444', borderRadius: '12px', padding: '22px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>❌</div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#f87171', margin: '0 0 6px 0' }}>
                      Pedido Não Aceite / Cancelado
                    </h3>
                    <p style={{ color: '#cbd5e1', fontSize: '13px', margin: 0 }}>
                      O Mestre não estava disponível de momento. Pode disparar um novo pedido para outro mestre da lista.
                    </p>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

        {/* ======================= COLUNA MESTRE ======================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)', minHeight: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>👔</span>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'white', margin: 0 }}>
                    Visão do Telemóvel do Mestre (App Pro)
                  </h2>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                    Recebe GPS, desloca-se, orçamenta e executa
                  </p>
                </div>
              </div>
              <span style={{ backgroundColor: '#0284c725', color: '#38bdf8', border: '1px solid #0284c750', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                {jobs.length} Activo{jobs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Lista de Chamados Activos para o Mestre */}
            {jobs.length === 0 ? (
              <div style={{ padding: '36px 16px', backgroundColor: '#0f172a', borderRadius: '12px', border: '1px dashed #334155', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#cbd5e1', margin: 0 }}>Nenhum chamado pendente ou em curso.</p>
                <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
                  Envie um pedido com ponto de referência no lado esquerdo (Cliente) para testar!
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {jobs.map((job) => {
                  const isSelected = activeJob?.id === job.id
                  const isActionLoading = loadingAction?.includes(job.id)

                  return (
                    <div 
                      key={job.id}
                      style={{
                        backgroundColor: isSelected ? '#1e3a8a25' : '#0f172a',
                        border: isSelected ? '2px solid #3b82f6' : '1px solid #334155',
                        borderRadius: '12px',
                        padding: '16px',
                        transition: 'all 0.15s'
                      }}
                    >
                      {/* Header do Cartão */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>
                              {job.client_name}
                            </span>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                              📞 {job.client_phone}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            Mestre solicitado: <strong>{job.provider_name}</strong>
                          </span>
                        </div>

                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: job.status === 'pending' ? '#eab30825' : job.status === 'in_progress' ? '#3b82f625' : job.status === 'awaiting_confirmation' ? '#10b98125' : '#0284c725',
                          color: job.status === 'pending' ? '#facc15' : job.status === 'in_progress' ? '#60a5fa' : job.status === 'awaiting_confirmation' ? '#34d399' : '#38bdf8',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          {job.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Problema & Ponto de Referência */}
                      <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '8px' }}>
                        <span style={{ color: '#94a3b8' }}>Problema: </span>
                        <strong>{job.problem_description}</strong>
                      </div>

                      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: '#facc15', marginBottom: '14px' }}>
                        📍 <strong>Ponto de Referência:</strong> {job.reference_point || 'Sem ponto especificado'}
                      </div>

                      {/* PAINEL DE AÇÃO CONFORME ESTADO DO TRABALHO */}
                      
                      {/* 1. SE PENDING: ACEITAR OU RECUSAR */}
                      {job.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleRejectJob(job.id)}
                            disabled={isActionLoading}
                            style={{ flex: 1, backgroundColor: '#451a1a', border: '1px solid #7f1d1d', color: '#fca5a5', fontWeight: 800, fontSize: '13px', padding: '9px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            ❌ Recusar
                          </button>
                          <button
                            onClick={() => {
                              handleAcceptJob(job.id)
                              setActiveJob(job)
                            }}
                            disabled={isActionLoading}
                            style={{ flex: 2, backgroundColor: '#16a34a', border: '1px solid #22c55e', color: 'white', fontWeight: 800, fontSize: '13px', padding: '9px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            ✅ Aceitar Chamado
                          </button>
                          <button
                            onClick={() => setActiveJob(job)}
                            style={{ backgroundColor: '#334155', border: '1px solid #475569', color: '#e2e8f0', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer' }}
                            title="Acompanhar no lado do cliente"
                          >
                            👁️
                          </button>
                        </div>
                      )}

                      {/* 2. SE ACCEPTED: INICIAR DESLOCAÇÃO */}
                      {job.status === 'accepted' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleStartTravel(job.id)}
                            disabled={isActionLoading}
                            style={{ flex: 1, backgroundColor: '#0284c7', border: '1px solid #38bdf8', color: 'white', fontWeight: 800, fontSize: '13px', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                          >
                            🚗 Sair para o Local (Iniciar Deslocação)
                          </button>
                          <button
                            onClick={() => setActiveJob(job)}
                            style={{ backgroundColor: '#334155', border: '1px solid #475569', color: '#e2e8f0', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            👁️
                          </button>
                        </div>
                      )}

                      {/* 3. SE EM DESLOCAÇÃO: PROPOR ORÇAMENTO NO LOCAL */}
                      {job.status === 'em_deslocacao' && (
                        <div style={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', padding: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
                            Chegou ao local? Diagnostique e proponha o orçamento:
                          </div>

                          {/* Editor simples de orçamento */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                            {quoteItems.map((item, idx) => (
                              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                                <input 
                                  type="text" 
                                  value={item.description}
                                  onChange={e => {
                                    const next = [...quoteItems]
                                    next[idx].description = e.target.value
                                    setQuoteItems(next)
                                  }}
                                  placeholder="Descrição (ex: Mão de obra)"
                                  style={{ padding: '6px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white', fontSize: '12px' }}
                                />
                                <input 
                                  type="number" 
                                  value={item.price}
                                  onChange={e => {
                                    const next = [...quoteItems]
                                    next[idx].price = Number(e.target.value)
                                    setQuoteItems(next)
                                  }}
                                  placeholder="Preço MT"
                                  style={{ padding: '6px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white', fontSize: '12px' }}
                                />
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '13px' }}>
                            <span style={{ color: '#94a3b8' }}>Total Orçado:</span>
                            <strong style={{ color: '#4ade80', fontSize: '15px' }}>{totalQuote.toLocaleString('pt-MZ')} MT</strong>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleProposeQuote(job.id)}
                              disabled={isActionLoading}
                              style={{ flex: 1, backgroundColor: '#eab308', border: '1px solid #facc15', color: '#0f172a', fontWeight: 800, fontSize: '13px', padding: '9px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              📋 Enviar Orçamento ao Cliente ({totalQuote} MT)
                            </button>
                            <button
                              onClick={() => setActiveJob(job)}
                              style={{ backgroundColor: '#334155', border: '1px solid #475569', color: '#e2e8f0', padding: '9px 12px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              👁️
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 4. SE NEGOTIATING: A AGUARDAR CLIENTE PAGAR */}
                      {job.status === 'negotiating' && (
                        <div style={{ backgroundColor: '#eab30810', border: '1px solid #eab30840', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#facc15' }}>
                          ⏳ <strong>Orçamento enviado ({Number(job.quoted_price || 0).toLocaleString('pt-MZ')} MT).</strong><br/>
                          <span style={{ color: '#cbd5e1', fontSize: '12px' }}>Aguardando o cliente aprovar e efetuar o pagamento seguro na plataforma...</span>
                        </div>
                      )}

                      {/* 5. SE IN_PROGRESS: EXECUTAR E CONCLUIR */}
                      {job.status === 'in_progress' && (
                        <div style={{ backgroundColor: '#2563eb15', border: '1px solid #3b82f640', borderRadius: '8px', padding: '12px' }}>
                          <div style={{ fontSize: '12px', color: '#93c5fd', marginBottom: '8px' }}>
                            🔒 <strong>Pagamento garantido em Escrow ({Number(job.quoted_price || 0).toLocaleString('pt-MZ')} MT).</strong> Pode realizar o serviço com total segurança!
                          </div>
                          
                          <button
                            onClick={() => handleFinishWork(job.id)}
                            disabled={isActionLoading}
                            style={{ width: '100%', backgroundColor: '#16a34a', border: '1px solid #22c55e', color: 'white', fontWeight: 800, fontSize: '13px', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            🏁 Marcar Serviço como Concluído
                          </button>
                        </div>
                      )}

                      {/* 6. SE AWAITING_CONFIRMATION: AGUARDAR CLIENTE CONFIRMAR */}
                      {job.status === 'awaiting_confirmation' && (
                        <div style={{ backgroundColor: '#10b98115', border: '1px solid #10b98140', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#34d399' }}>
                          ✨ <strong>Serviço concluído!</strong> A aguardar que o cliente inspecione e aprove a libertação do pagamento ({Number(job.quoted_price || 0).toLocaleString('pt-MZ')} MT).
                        </div>
                      )}

                    </div>
                  )
                })}
              </div>
            )}

            {/* Urgências SOS */}
            <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '18px' }}>🚨</span>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#f87171', margin: 0 }}>
                  Urgências SOS (Botão Vermelho) ({requests.length})
                </h3>
              </div>

              {requests.length === 0 ? (
                <div style={{ padding: '14px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px dashed #334155', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
                  Sem urgências SOS abertas.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {requests.map(req => (
                    <div key={req.id} style={{ backgroundColor: '#451a1a20', border: '1px solid #7f1d1d', padding: '10px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#fca5a5' }}>{req.title}</strong>
                        <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>{req.description}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => rejectRequest(req.id)}
                          style={{ backgroundColor: '#334155', color: '#fca5a5', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Recusar
                        </button>
                        <button
                          onClick={() => acceptRequest(req.id)}
                          style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Aceitar SOS
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
