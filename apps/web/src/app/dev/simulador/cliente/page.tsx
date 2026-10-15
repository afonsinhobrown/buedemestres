'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

const CATEGORIAS = [
  { id: 2, emoji: '🔧', nome: 'Mecânico', desc: 'Avaria, motor, travões, socorro', cor: '#BF3A21' },
  { id: 11, emoji: '⚡', nome: 'Electricista', desc: 'Instalações, avarias, curto-circuito', cor: '#2444C8' },
  { id: 10, emoji: '🚿', nome: 'Canalizador', desc: 'Fugas, torneiras, entupimentos', cor: '#FFC61A', text: '#12163A' },
  { id: 13, emoji: '🔑', nome: 'Chaveiro', desc: 'Fechaduras, portas encravadas', cor: '#12163A' },
  { id: 8, emoji: '🧱', nome: 'Pedreiro', desc: 'Obras rápidas, reboco, fissuras', cor: '#2563EB' },
  { id: 31, emoji: '🧹', nome: 'Limpeza', desc: 'Residencial, escritório, pós-obra', cor: '#059669' },
]

export default function SimuladorClientePage() {
  const [step, setStep] = useState<'home' | 'descricao' | 'procurando' | 'a_caminho' | 'preco' | 'concluido'>('home')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [descricao, setDescricao] = useState('O meu carro parou de repente e o motor não arranca.')
  const [referencia, setReferencia] = useState('Junto ao Mercado do Xipamanine, portão azul')
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [mestre, setMestre] = useState({ nome: 'Provedor 1', telefone: '+258 84 999 9999', nota: '5.0' })
  const [ronda, setRonda] = useState(1)

  // Verificar se o Provedor 1 está online
  useEffect(() => {
    async function checkOnline() {
      const { data } = await supabase
        .from('provider_presence')
        .select('provider_id')
        .eq('is_online', true)
        .contains('categories', [categoria.id])

      setOnlineCount(data ? data.length : 1)
    }
    checkOnline()
  }, [categoria.id])

  // Escutar Realtime se o mestre aceitar
  useEffect(() => {
    if (!requestId) return

    const channel = supabase
      .channel(`web_req_${requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `id=eq.${requestId}` },
        async (payload) => {
          if (payload.new.status === 'accepted') {
            if (payload.new.target_provider_id) {
              const { data: prov } = await supabase
                .from('provider_profiles')
                .select('business_name, rating_avg, profiles:profile_id(full_name, phone)')
                .eq('profile_id', payload.new.target_provider_id)
                .single()
              if (prov) {
                setMestre({
                  nome: prov.business_name || (prov.profiles as any)?.full_name || 'Provedor 1',
                  telefone: (prov.profiles as any)?.phone || '+258 84 999 9999',
                  nota: prov.rating_avg ? Number(prov.rating_avg).toFixed(1) : '5.0'
                })
              }
            }
            setStep('a_caminho')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [requestId])

  const handleEnviarPedido = async () => {
    setStep('procurando')
    setRonda(1)

    // Garantir que Cliente 1 existe
    await supabase.from('profiles').upsert({
      id: '11111111-1111-1111-1111-111111111111',
      full_name: 'Cliente 1',
      phone: '+258 84 000 0001',
      role: 'client'
    }, { onConflict: 'id' })

    // Criar pedido real na cloud
    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        client_id: '11111111-1111-1111-1111-111111111111',
        title: `Pedido urgente: ${categoria.nome}`,
        category_id: categoria.id,
        description: descricao,
        location_note: referencia,
        mode: 'on_demand',
        location: 'POINT(32.5700 -25.9680)',
        search_radius_m: 5000
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar pedido:', error)
      alert('Erro ao enviar pedido para a cloud')
    } else {
      setRequestId(data.id)
    }
  }

  const handleCancelar = async () => {
    if (requestId) {
      await supabase.from('service_requests').update({ status: 'cancelled' }).eq('id', requestId)
    }
    setStep('home')
    setRequestId(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#EDF0F2', color: '#12163A', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Barra de Status Mobile */}
      <div style={{ background: '#12163A', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700 }}>
        <span>09:41</span>
        <span style={{ color: '#FFC61A', letterSpacing: 0.5 }}>📱 CLIENTE 1</span>
        <span>LTE 100%</span>
      </div>

      {/* CABEÇALHO */}
      <div style={{ background: '#12163A', padding: '16px 20px 20px', color: '#fff', borderBottom: '3px solid #FFC61A' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Olá, Cliente 1 👋</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#F5F0E8', letterSpacing: -0.5 }}>Bué de Mestres</div>
          </div>
          {step !== 'home' && (
            <button 
              onClick={() => setStep('home')}
              style={{ background: '#1E293B', color: '#FFC61A', border: '1px solid #475569', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
            >
              ← Início
            </button>
          )}
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column' }}>

        {/* 1. ECRÃ INICIAL / ESCOLHA */}
        {step === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#fff', padding: 14, borderRadius: 10, border: '2px solid #12163A', boxShadow: '0 3px 0 #12163A' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#2444C8', textTransform: 'uppercase' }}>🚨 Socorro Imediato</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#12163A', marginTop: 2 }}>De que mestre precisas agora?</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Mestres profissionais em Maputo a poucos minutos de ti.</div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
              Escolhe o serviço urgente:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {CATEGORIAS.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setCategoria(cat)
                    setStep('descricao')
                  }}
                  style={{
                    background: cat.cor,
                    color: cat.text || '#fff',
                    border: '2px solid #12163A',
                    borderRadius: 8,
                    padding: '14px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 3px 0 #12163A',
                    transition: 'transform 0.1s'
                  }}
                >
                  <div style={{ fontSize: 26, marginBottom: 4 }}>{cat.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cat.nome}</div>
                  <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{cat.desc.split(',')[0]}</div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 10, background: 'rgba(36, 68, 200, 0.08)', padding: 12, borderRadius: 8, border: '1px solid rgba(36, 68, 200, 0.2)', fontSize: 12, color: '#1E293B' }}>
              ℹ️ <strong>Mestre Pronto:</strong> O <em>Provedor 1</em> está activo e online para atender o teu pedido em tempo real.
            </div>
          </div>
        )}

        {/* 2. DESCRIÇÃO E PONTO DE REFERÊNCIA */}
        {step === 'descricao' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: categoria.cor, color: categoria.text || '#fff', padding: '10px 14px', borderRadius: 8, border: '2px solid #12163A' }}>
              <span style={{ fontSize: 22 }}>{categoria.emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase' }}>{categoria.nome}</div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>{categoria.desc}</div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#12163A', textTransform: 'uppercase' }}>Qual é a avaria / problema?</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                rows={3}
                style={{ width: '100%', marginTop: 4, padding: 10, borderRadius: 8, border: '2px solid #CBD5E1', fontSize: 13, color: '#12163A', resize: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#12163A', textTransform: 'uppercase' }}>📍 Ponto de Referência (Maputo)</label>
              <input
                value={referencia}
                onChange={e => setReferencia(e.target.value)}
                style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 8, border: '2px solid #CBD5E1', fontSize: 13, color: '#12163A' }}
              />
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                💡 Ajuda muito o mestre a encontrar a tua localização sem demoras.
              </div>
            </div>

            <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 8, border: '1px solid #10B981', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🟢</span>
              <div style={{ fontSize: 12, color: '#065F46', fontWeight: 700 }}>
                {onlineCount && onlineCount > 0 ? `${onlineCount} mestre online na tua área` : 'Provedor 1 pronto para atender'}
              </div>
            </div>

            <button
              onClick={handleEnviarPedido}
              style={{
                marginTop: 8,
                background: '#12163A',
                color: '#FFC61A',
                border: '2px solid #FFC61A',
                borderRadius: 8,
                padding: '14px',
                fontSize: 14,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: 1,
                cursor: 'pointer',
                boxShadow: '0 4px 0 #000'
              }}
            >
              🔍 Enviar e Procurar Mestre →
            </button>
          </div>
        )}

        {/* 3. A PROCURAR MESTRE (RADAR) */}
        {step === 'procurando' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 10 }}>
            <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'rgba(36, 68, 200, 0.1)', border: '2px solid #2444C8', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
              <div style={{ position: 'absolute', width: 90, height: 90, borderRadius: '50%', background: 'rgba(36, 68, 200, 0.15)' }} />
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#2444C8', color: '#FFC61A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, zIndex: 2, border: '3px solid #fff' }}>
                {categoria.emoji}
              </div>
            </div>

            <div style={{ fontSize: 18, fontWeight: 900, color: '#12163A' }}>A procurar mestre próximo...</div>
            <div style={{ fontSize: 13, color: '#2563EB', fontWeight: 800, marginTop: 2 }}>{categoria.nome.toUpperCase()}</div>

            <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, margin: '14px 0' }}>
              🟢 Provedor 1 a receber o sinal em tempo real...
            </div>

            <div style={{ fontSize: 12, color: '#64748B', maxWidth: 260, lineHeight: 1.4 }}>
              O pedido foi emitido no Supabase Realtime. Repara no <strong>App Pro</strong> ao lado para ver o pedido a chegar e clica em <strong>ACEITAR</strong>!
            </div>

            <button
              onClick={handleCancelar}
              style={{ marginTop: 24, background: 'transparent', color: '#EF4444', border: '1px solid #EF4444', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              Cancelar pedido
            </button>
          </div>
        )}

        {/* 4. MESTRE A CAMINHO */}
        {step === 'a_caminho' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#22C55E', color: '#0F2D1A', padding: '16px', borderRadius: 10, border: '2px solid #0F2D1A', textAlign: 'center' }}>
              <div style={{ fontSize: 32 }}>🎉</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Mestre a Caminho!</div>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>O profissional aceitou o pedido e já está a deslocar-se.</div>
            </div>

            <div style={{ background: '#fff', padding: 14, borderRadius: 10, border: '2px solid #12163A', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: '#12163A', color: '#FFC61A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {categoria.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#12163A' }}>{mestre.nome}</div>
                <div style={{ fontSize: 12, color: '#059669', fontWeight: 800 }}>⭐ {mestre.nota} · Verificado ✓</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'center' }}>
              <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #CBD5E1' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#2563EB' }}>8 min</div>
                <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Tempo estimado</div>
              </div>
              <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #CBD5E1' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#2563EB' }}>2.1 km</div>
                <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Distância</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={`tel:${mestre.telefone}`}
                style={{ flex: 1, background: '#12163A', color: '#fff', textDecoration: 'none', padding: '10px', borderRadius: 6, fontSize: 12, fontWeight: 800, textAlign: 'center' }}
              >
                📞 Ligar ({mestre.telefone})
              </a>
              <button
                onClick={() => setStep('preco')}
                style={{ flex: 1, background: '#FFC61A', color: '#12163A', border: '2px solid #12163A', borderRadius: 6, padding: '10px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}
              >
                Ver Preço Proposto →
              </button>
            </div>
          </div>
        )}

        {/* 5. PROPOSTA DE PREÇO & PAGAMENTO RETIDO */}
        {step === 'preco' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#fff', padding: 14, borderRadius: 10, border: '2px solid #12163A' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Orçamento do Diagnóstico</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#12163A', marginTop: 2 }}>Proposta do {mestre.nome}</div>

              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: 4 }}>
                  <span>Diagnóstico & Mão de obra</span>
                  <strong>MT 800,00</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: 4 }}>
                  <span>Material / Peça de reposição</span>
                  <strong>MT 400,00</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, fontSize: 15, fontWeight: 900, color: '#2563EB' }}>
                  <span>Total</span>
                  <span>MT 1.200,00</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#FEF3C7', padding: 12, borderRadius: 8, border: '1px solid #F59E0B', fontSize: 12, color: '#92400E', lineHeight: 1.4 }}>
              🔒 <strong>Garantia de Pagamento Retido:</strong> O valor de MT 1.200 fica guardado com segurança na plataforma e só será transferido ao mestre quando confirmares que o serviço foi bem feito.
            </div>

            <button
              onClick={() => setStep('concluido')}
              style={{
                background: '#059669',
                color: '#fff',
                border: '2px solid #065F46',
                borderRadius: 8,
                padding: '14px',
                fontSize: 14,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: 1,
                cursor: 'pointer',
                boxShadow: '0 4px 0 #065F46'
              }}
            >
              💳 Pagar e Reter via M-Pesa →
            </button>
          </div>
        )}

        {/* 6. CONCLUÍDO */}
        {step === 'concluido' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12 }}>
            <div style={{ fontSize: 44 }}>⭐</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#12163A' }}>Serviço Concluído!</div>
            <div style={{ fontSize: 13, color: '#64748B', maxWidth: 280, lineHeight: 1.4 }}>
              O pagamento de MT 1.200 foi libertado ao {mestre.nome}. Muito obrigado por usares a Bué de Mestres!
            </div>
            <button
              onClick={() => {
                setStep('home')
                setRequestId(null)
              }}
              style={{ marginTop: 14, background: '#12163A', color: '#FFC61A', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
            >
              Fazer novo pedido
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
