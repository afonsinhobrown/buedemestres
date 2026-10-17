import webpush from 'web-push'
import { db } from '@/lib/db'

type PushPayload = {
  title: string
  body: string
  url?: string
  data?: Record<string, unknown>
}

type SubscriptionRow = {
  id: string
  profile_id: string
  platform: 'web' | 'ios' | 'android'
  endpoint: string | null
  p256dh: string | null
  auth: string | null
  expo_token: string | null
}

let vapidConfigured = false

function configureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@buedemestres.com',
    publicKey,
    privateKey
  )
  vapidConfigured = true
  return true
}

async function sendExpoBatch(messages: Record<string, unknown>[]) {
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100)
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      })
    } catch (error) {
      console.error('Erro ao enviar push Expo:', error)
    }
  }
}

export async function enviarPushParaPerfis(profileIds: string[], payload: PushPayload) {
  const ids = [...new Set(profileIds.filter(Boolean))]
  if (ids.length === 0) return { sent: 0 }

  const { rows } = await db.query<SubscriptionRow>(
    `select id, profile_id, platform, endpoint, p256dh, auth, expo_token
       from push_subscriptions
      where profile_id = any($1::uuid[])`,
    [ids]
  )

  if (rows.length === 0) return { sent: 0 }

  const webOk = configureVapid()
  const expoMessages: Record<string, unknown>[] = []
  let sent = 0

  for (const sub of rows) {
    if (sub.expo_token) {
      expoMessages.push({
        to: sub.expo_token,
        title: payload.title,
        body: payload.body,
        sound: 'default',
        data: { ...payload.data, url: payload.url || '/notificacoes' },
      })
      continue
    }

    if (!sub.endpoint || !sub.p256dh || !sub.auth || !webOk) continue

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url || '/painel',
          data: payload.data || {},
        })
      )
      sent += 1
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await db.query('delete from push_subscriptions where id = $1', [sub.id]).catch(() => {})
      } else {
        console.error('Erro Web Push:', error?.message || error)
      }
    }
  }

  if (expoMessages.length > 0) {
    await sendExpoBatch(expoMessages)
    sent += expoMessages.length
  }

  return { sent }
}

export async function despacharNotificacoesPendentes(limit = 200) {
  const { rows } = await db.query(
    `select id, profile_id, title, body, data, created_at
       from notifications
      where push_sent_at is null
        and created_at >= now() - interval '1 day'
      order by created_at asc
      limit $1`,
    [limit]
  )

  let enviados = 0
  for (const notification of rows) {
    try {
      const data = (notification.data || {}) as Record<string, unknown>
      const url =
        typeof data.url === 'string'
          ? data.url
          : data.job_id
          ? `/pedidos/${data.job_id}`
          : '/notificacoes'
      const result = await enviarPushParaPerfis([notification.profile_id], {
        title: notification.title,
        body: notification.body,
        url,
        data,
      })
      enviados += result.sent
    } catch (error) {
      console.error('Erro ao despachar notificação', notification.id, error)
    } finally {
      await db.query('update notifications set push_sent_at = now() where id = $1', [notification.id]).catch(() => {})
    }
  }

  return { processed: rows.length, enviados }
}
