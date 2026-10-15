'use client'

/**
 * Simulador = as APPS REAIS (apps/cliente e apps/pro) a correr no browser via Expo Web.
 * Nada aqui é cópia: cada moldura carrega a app verdadeira.
 *
 * Arrancar antes de abrir esta página:
 *   pnpm --filter cliente exec expo start --web --port 8081
 *   pnpm --filter pro     exec expo start --web --port 8082
 */
import { useState } from 'react'

const APPS = [
  { label: 'App Cliente', url: process.env.NEXT_PUBLIC_SIM_CLIENTE_URL || 'http://localhost:8081' },
  { label: 'App Mestre (Pro)', url: process.env.NEXT_PUBLIC_SIM_PRO_URL || 'http://localhost:8082' },
]

function Phone({ label, url }: { label: string; url: string }) {
  const [key, setKey] = useState(0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#cbd5e1', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
        <button onClick={() => setKey(k => k + 1)} title="Recarregar app" style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>↻</button>
        <a href={url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 12, textTransform: 'none' }}>abrir ↗</a>
      </div>
      <div style={{ width: 390, height: 820, borderRadius: 50, background: '#000', padding: 12, boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 0 0 2px #333' }}>
        <iframe
          key={key}
          src={url}
          title={label}
          allow="geolocation; camera; microphone"
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 38, background: '#fff' }}
        />
      </div>
    </div>
  )
}

export default function SimuladorPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#0b1020', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#fff', fontSize: 18, margin: '0 0 6px' }}>📱 Simulador — apps reais</h1>
      <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, margin: '0 0 24px' }}>
        Se um telemóvel ficar em branco, arranca a app: <code>pnpm sim</code>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, justifyContent: 'center' }}>
        {APPS.map(a => <Phone key={a.label} {...a} />)}
      </div>
    </main>
  )
}
