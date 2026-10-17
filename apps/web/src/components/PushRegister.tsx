'use client'

import { useEffect, useState } from 'react'

type State = 'loading' | 'hidden' | 'available' | 'denied' | 'done'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function PushRegister() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    async function check() {
      if (typeof window === 'undefined') return
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (active) setState('hidden')
        return
      }
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        if (active) setState('hidden')
        return
      }
      try {
        const res = await fetch('/api/push/subscribe')
        if (!res.ok) {
          if (active) setState('hidden')
          return
        }
        const data = await res.json()
        if (!data.authenticated) {
          if (active) setState('hidden')
          return
        }
        const registration = await navigator.serviceWorker.getRegistration('/sw.js')
        const existing = await registration?.pushManager.getSubscription()
        if (existing) {
          if (active) setState('done')
          return
        }
        if (Notification.permission === 'denied') {
          if (active) setState('denied')
        } else if (Notification.permission === 'granted') {
          if (active) setState('available')
        } else {
          if (active) setState('available')
        }
      } catch {
        if (active) setState('hidden')
      }
    }
    check()
    return () => {
      active = false
    }
  }, [])

  async function activate() {
    setBusy(true)
    setMessage('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!res.ok) throw new Error('Não foi possível guardar a subscrição.')

      setState('done')
    } catch (error: any) {
      setMessage(error?.message || 'Falha ao ativar notificações.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'available') {
    return (
      <button
        onClick={activate}
        disabled={busy}
        className="fixed bottom-4 right-4 z-50 bg-[#12163A] text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg border-2 border-[#FFC61A] disabled:opacity-60"
      >
        {busy ? 'A ativar...' : '🔔 Ativar notificações'}
        {message && <span className="block text-[10px] font-normal text-red-200 mt-1">{message}</span>}
      </button>
    )
  }

  if (state === 'denied') {
    return (
      <div className="fixed bottom-4 right-4 z-40 max-w-xs bg-white border border-red-200 text-red-700 text-xs rounded-xl shadow-lg px-4 py-3">
        Notificações bloqueadas no navegador. Ativa-as nas definições do site para receberes avisos.
      </div>
    )
  }

  return null
}
