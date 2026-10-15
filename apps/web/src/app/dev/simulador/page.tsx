'use client'

/**
 * Simulador Integrado - Bué de Mestres
 * 
 * - Telemóveis com as Apps Reais (apps/cliente na porta 8081 e apps/pro na porta 8082)
 * - Mapa Interativo com GPS e pontos de referência (Xipamanine, Alto Maé, etc.)
 * - Atalhos rápidos para Painel Admin de Verificações (/admin/verificacoes)
 * - Indicador de Políticas de Retenção (11º serviço 0% comissão para mestre; 10% desconto após 10 serviços para cliente)
 */
import { useState } from 'react'

function Phone({ label, url, reloadKey }: { label: string; url: string; reloadKey: number }) {
  const [key, setKey] = useState(0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#cbd5e1', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
        <button 
          onClick={() => setKey(k => k + 1)} 
          title="Recarregar app" 
          style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
        >
          ↻
        </button>
        <a href={url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 12, textTransform: 'none' }}>abrir ↗</a>
      </div>
      <div style={{ width: 380, height: 760, borderRadius: 48, background: '#000', padding: 12, boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 0 0 2px #333' }}>
        <iframe
          key={`${key}-${reloadKey}`}
          src={url}
          title={label}
          allow="geolocation; camera; microphone"
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 36, background: '#fff' }}
        />
      </div>
    </div>
  )
}

export default function SimuladorPage() {
  const [showMap, setShowMap] = useState(true)
  const [envMode, setEnvMode] = useState<'cloud' | 'local'>('cloud')
  const [reloadKey, setReloadKey] = useState(0)
  const [mapCoords, setMapCoords] = useState({ lat: -25.9458, lng: 32.5594, label: 'Xipamanine, Maputo' })

  // OpenStreetMap embed URL centrado nas coordenadas
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lng - 0.03}%2C${mapCoords.lat - 0.02}%2C${mapCoords.lng + 0.03}%2C${mapCoords.lat + 0.02}&layer=mapnik&marker=${mapCoords.lat}%2C${mapCoords.lng}`

  const apps = [
    {
      label: 'App Cliente (Expo Oficial)',
      url: envMode === 'cloud' 
        ? '/apps/cliente' 
        : (process.env.NEXT_PUBLIC_SIM_CLIENTE_URL || 'http://localhost:8081')
    },
    {
      label: 'App Mestre Pro (Expo Oficial)',
      url: envMode === 'cloud' 
        ? '/apps/pro' 
        : (process.env.NEXT_PUBLIC_SIM_PRO_URL || 'http://localhost:8082')
    },
  ]

  return (
    <main style={{ minHeight: '100vh', background: '#0b1020', padding: '20px 24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Barra de Topo com Atalhos e Selector de Ambiente */}
      <header style={{ maxWidth: 1320, margin: '0 auto 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, background: '#1e293b', padding: '14px 20px', borderRadius: 12, border: '1px solid #334155' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#fff' }}>
              Simulador Plataforma Bué de Mestres
            </h1>
            <span style={{ background: envMode === 'cloud' ? '#22c55e25' : '#3b82f625', color: envMode === 'cloud' ? '#4ade80' : '#60a5fa', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, border: `1px solid ${envMode === 'cloud' ? '#22c55e40' : '#3b82f640'}` }}>
              {envMode === 'cloud' ? '☁️ Modo Cloud (Vercel)' : '💻 Modo Localhost'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 12 }}>
            🎁 <strong>1 Cliente & 1 Provedor:</strong> Totalmente integrado com Supabase Realtime na cloud.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Alternador de Ambiente Cloud / Localhost */}
          <div style={{ background: '#0f172a', borderRadius: 8, padding: 3, display: 'flex', border: '1px solid #334155' }}>
            <button
              onClick={() => { setEnvMode('cloud'); setReloadKey(k => k + 1) }}
              style={{
                background: envMode === 'cloud' ? '#22c55e' : 'transparent',
                color: envMode === 'cloud' ? '#052e16' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              ☁️ Cloud
            </button>
            <button
              onClick={() => { setEnvMode('local'); setReloadKey(k => k + 1) }}
              style={{
                background: envMode === 'local' ? '#3b82f6' : 'transparent',
                color: envMode === 'local' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              💻 Localhost
            </button>
          </div>

          <button
            onClick={() => setShowMap(!showMap)}
            style={{
              background: showMap ? '#2563eb' : '#334155',
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {showMap ? '🗺️ Ocultar Mapa' : '🗺️ Ver Mapa ao Vivo'}
          </button>

          <a
            href="/admin/verificacoes"
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#047857',
              color: '#fff',
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            🛡️ Painel Admin ↗
          </a>
        </div>
      </header>

      {/* Secção do Mapa ao Vivo (se ativado) */}
      {showMap && (
        <section style={{ maxWidth: 1320, margin: '0 auto 24px', background: '#1e293b', border: '1px solid #334155', borderRadius: 14, overflow: 'hidden', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: 14 }}>📍 Acompanhamento em Mapa (Maputo, MZ)</span>
              <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 8 }}>Ponto seleccionado: <strong style={{ color: '#38bdf8' }}>{mapCoords.label}</strong></span>
            </div>
            
            {/* Presets de Maputo */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: 'Xipamanine', lat: -25.9458, lng: 32.5594 },
                { label: 'Polana Caniço', lat: -25.9325, lng: 32.5878 },
                { label: 'Alto Maé', lat: -25.9612, lng: 32.5711 },
                { label: 'Costa do Sol', lat: -25.9089, lng: 32.6244 }
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => setMapCoords({ lat: preset.lat, lng: preset.lng, label: `${preset.label}, Maputo` })}
                  style={{
                    background: mapCoords.label.startsWith(preset.label) ? '#0284c7' : '#0f172a',
                    color: '#fff',
                    border: '1px solid #334155',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  📍 {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 260, borderRadius: 10, overflow: 'hidden', border: '1px solid #475569' }}>
            <iframe
              src={osmUrl}
              title="Mapa OpenStreetMap"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        </section>
      )}

      {/* Grid com os 2 Telemóveis das Apps */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 36, justifyContent: 'center', alignItems: 'flex-start' }}>
        {apps.map(a => <Phone key={a.label} label={a.label} url={a.url} reloadKey={reloadKey} />)}
      </div>
    </main>
  )
}
