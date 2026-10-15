'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SimuladorProPage() {
  const [isOnline, setIsOnline] = useState(true)
  const [newRequest, setNewRequest] = useState<any>(null)
  const [jobEmCurso, setJobEmCurso] = useState<any>(null)
  const [trabalhosHoje, setTrabalhosHoje] = useState(0)
  const [transporte, setTransporte] = useState('🚗 Carro Pessoal')
  const [fase, setFase] = useState<'espera' | 'a_caminho' | 'diagnostico' | 'concluido'>('espera')

  const proId = '22222222-2222-2222-2222-222222222222'

  // Manter Provedor 1 Online no Supabase com Heartbeat
  useEffect(() => {
    async function updatePresence() {
      if (!isOnline) {
        await supabase.from('provider_presence').update({ is_online: false }).eq('provider_id', proId)
        return
      }

      await supabase.from('provider_presence').upsert({
        provider_id: proId,
        is_online: true,
        categories: [2, 10, 11, 13, 8, 31],
        updated_at: new Date().toISOString()
      }, { onConflict: 'provider_id' })
    }

    updatePresence()

    const interval = setInterval(updatePresence, 35000)
    return () => clearInterval(interval)
  }, [isOnline])

  // Escutar novos pedidos urgentes via Supabase Realtime
  useEffect(() => {
    if (!isOnline) {
      setNewRequest(null)
      return
    }

    const channel = supabase
      .channel('pro_cloud_listener_' + Date.now())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_requests' },
        (payload) => {
          console.log('🚨 Provedor 1 recebeu pedido urgente:', payload.new)
          if (payload.new.status === 'open') {
            setNewRequest(payload.new)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests' },
        (payload) => {
          if (payload.new.status !== 'open' && newRequest?.id === payload.new.id) {
            setNewRequest(null)
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Provedor 1 Realtime Status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOnline, newRequest])

  const handleAceitar = async () => {
    if (!newRequest) return
    const req = newRequest

    // Atualizar na base de dados para accepted e associar a Provedor 1
    const { error } = await supabase
      .from('service_requests')
      .update({
        status: 'accepted',
        target_provider_id: proId
      })
      .eq('id', req.id)

    if (error) {
      console.error('Erro ao aceitar:', error)
      alert('Erro ao aceitar pedido')
      return
    }

    setJobEmCurso(req)
    setNewRequest(null)
    setFase('a_caminho')
    setTrabalhosHoje(t => t + 1)
  }

  const handleRecusar = async () => {
    if (!newRequest) return
    await supabase.from('service_requests').update({ status: 'cancelled' }).eq('id', newRequest.id)
    setNewRequest(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: isOnline ? '#0F172A' : '#1E293B', color: '#F8FAFC', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Barra de Status Mobile */}
      <div style={{ background: '#090D16', color: '#94A3B8', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700 }}>
        <span>09:41</span>
        <span style={{ color: '#4ADE80', letterSpacing: 0.5 }}>🔨 PROVEDOR 1 (MESTRE)</span>
        <span>4G 100%</span>
      </div>

      {/* CABEÇALHO */}
      <div style={{ background: '#0F172A', padding: '16px 20px', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#F8FAFC', letterSpacing: -0.5 }}>🔨 Bué de Mestres Pro</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <span style={{ background: '#F2C94C', color: '#1A1A2E', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>
                ESPECIALIDADE: MECÂNICO
              </span>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>Provedor 1</span>
            </div>
          </div>

          {/* Toggle Online */}
          <button
            onClick={() => setIsOnline(!isOnline)}
            style={{
              background: isOnline ? '#166534' : '#334155',
              color: isOnline ? '#4ADE80' : '#94A3B8',
              border: `1px solid ${isOnline ? '#22C55E' : '#475569'}`,
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 4, background: isOnline ? '#4ADE80' : '#94A3B8' }} />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </button>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column' }}>

        {/* MODAL / BANNER DE NOVO PEDIDO EM TEMPO REAL */}
        {newRequest && (
          <div style={{
            background: '#1E293B',
            border: '2px solid #22C55E',
            borderRadius: 14,
            padding: 18,
            marginBottom: 16,
            boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.4)',
            animation: 'pulse 1s infinite'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ADE80', fontSize: 11, fontWeight: 900, padding: '3px 8px', borderRadius: 6 }}>
                ⚡ NOVO PEDIDO URGENTE
              </span>
              <span style={{ color: '#F2C94C', fontSize: 12, fontWeight: 800 }}>📍 2.1 km</span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginBottom: 4 }}>
              {newRequest.title || 'Socorro Mecânico'}
            </div>
            
            <div style={{ fontSize: 13, color: '#CBD5E1', marginBottom: 8, lineHeight: 1.4 }}>
              "{newRequest.description}"
            </div>

            {newRequest.location_note && (
              <div style={{ fontSize: 12, color: '#38BDF8', marginBottom: 14, fontWeight: 700 }}>
                📍 Ref: {newRequest.location_note}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleRecusar}
                style={{ flex: 1, background: '#451A1A', color: '#FCA5A5', border: '1px solid #7F1D1D', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                Recusar
              </button>
              <button
                onClick={handleAceitar}
                style={{ flex: 2, background: '#22C55E', color: '#052E16', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer', boxShadow: '0 4px 0 #15803D' }}
              >
                ACEITAR E PARTIR →
              </button>
            </div>
          </div>
        )}

        {/* ESTATÍSTICAS DO MESTRE */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 8px', borderRadius: 10, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#F2C94C' }}>{trabalhosHoje}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Hoje</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 8px', borderRadius: 10, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#4ADE80' }}>MT 0</div>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Ganhos</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 8px', borderRadius: 10, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#38BDF8' }}>⭐ 5.0</div>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Nota</div>
          </div>
        </div>

        {/* FASE 1: ESPERA */}
        {fase === 'espera' && !newRequest && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 14, border: '2px solid rgba(34, 197, 94, 0.3)' }}>
              🟢
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#F8FAFC' }}>A aguardar pedidos na tua área...</div>
            <div style={{ fontSize: 12, color: '#94A3B8', maxWidth: 260, marginTop: 6, lineHeight: 1.4 }}>
              O teu radar está activo no Supabase Realtime. Envia um pedido a partir do <strong>App Cliente</strong> ao lado para veres o alerta instantâneo!
            </div>
          </div>
        )}

        {/* FASE 2: A CAMINHO DO CLIENTE */}
        {fase === 'a_caminho' && jobEmCurso && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#1E293B', padding: 16, borderRadius: 12, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#4ADE80', fontWeight: 800 }}>● EM DESLOCAÇÃO</span>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>ETA: 8 min</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{jobEmCurso.title}</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>📍 Destino: {jobEmCurso.location_note || 'Xipamanine, Maputo'}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 }}>
                Como te estás a deslocar?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {['🚗 Carro Pessoal', '🚐 Chapa', '🏍️ Txopela', '🚶 A pé'].map(m => (
                  <button
                    key={m}
                    onClick={() => setTransporte(m)}
                    style={{
                      background: transporte === m ? '#2563EB' : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      border: `1px solid ${transporte === m ? '#60A5FA' : 'rgba(255,255,255,0.1)'}`,
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href="https://maps.google.com/?q=-25.9458,32.5594"
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, background: '#334155', color: '#fff', textDecoration: 'none', padding: '12px', borderRadius: 8, fontSize: 12, fontWeight: 800, textAlign: 'center' }}
              >
                🗺️ Abrir no Maps
              </a>
              <button
                onClick={() => setFase('diagnostico')}
                style={{ flex: 2, background: '#22C55E', color: '#052E16', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
              >
                📍 CHEGUEI AO LOCAL →
              </button>
            </div>
          </div>
        )}

        {/* FASE 3: DIAGNÓSTICO & PROPOR ORÇAMENTO */}
        {fase === 'diagnostico' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#1E293B', padding: 16, borderRadius: 12, border: '1px solid #334155' }}>
              <div style={{ fontSize: 12, color: '#F2C94C', fontWeight: 800 }}>🔧 NO LOCAL DO SERVIÇO</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2 }}>Diagnóstico Concluído</div>
              <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 8 }}>
                Propõe o valor do serviço ao Cliente 1 para o pagamento ficar retido com segurança na plataforma.
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800 }}>Valor a propor ao cliente:</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#4ADE80', marginTop: 4 }}>MT 1.200,00</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Comissão retida da plataforma: 10% (MT 120,00)</div>
            </div>

            <button
              onClick={() => {
                alert('Orçamento de MT 1.200,00 enviado ao Cliente 1!')
                setFase('concluido')
              }}
              style={{ background: '#F2C94C', color: '#1A1A2E', border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer' }}
            >
              Enviar Orçamento ao Cliente →
            </button>
          </div>
        )}

        {/* FASE 4: CONCLUÍDO */}
        {fase === 'concluido' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12 }}>
            <div style={{ fontSize: 44 }}>💰</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#F8FAFC' }}>Trabalho Registado com Sucesso!</div>
            <div style={{ fontSize: 13, color: '#94A3B8', maxWidth: 260 }}>
              O cliente confirma o pagamento na app e o valor é creditado na tua carteira.
            </div>
            <button
              onClick={() => {
                setFase('espera')
                setJobEmCurso(null)
              }}
              style={{ marginTop: 10, background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              Ficar Disponível para Novos Pedidos
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
