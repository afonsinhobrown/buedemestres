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

type ExpoTicket = {
  status?: 'ok' | 'error'
  message?: string
  details?: { error?: string; expoPushToken?: string }
}

type ExpoResponse = {
  data?: ExpoTicket | ExpoTicket[]
  errors?: { message?: string }[]
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : 'Erro desconhecido'
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
  let ok = 0
  const invalidTokens: string[] = []
  let lastError: string | null = null

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }
      if (process.env.EXPO_ACCESS_TOKEN) {
        headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`
      }

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
      })

      if (!response.ok) {
        lastError = `Expo respondeu ${response.status}`
        console.error('Erro ao enviar push Expo:', lastError)
        continue
      }

      const payload = (await response.json()) as ExpoResponse
      if (payload.errors?.length) {
        lastError = payload.errors.map((e) => e.message).filter(Boolean).join('; ') || lastError
      }

      const tickets = Array.isArray(payload.data)
        ? payload.data
        : payload.data
        ? [payload.data]
        : []

      for (const ticket of tickets) {
        if (ticket.status === 'ok') {
          ok += 1
          continue
        }
        const code = ticket.details?.error || ''
        const token = ticket.details?.expoPushToken
        if (token && (code === 'DeviceNotRegistered' || code === 'InvalidCredentials')) {
          invalidTokens.push(token)
        }
        lastError = [ticket.message, code].filter(Boolean).join(' - ') || lastError
      }
    } catch (error) {
      lastError = errorText(error)
      console.error('Erro ao enviar push Expo:', error)
    }
  }

  return { ok, invalidTokens, error: lastError }
}

export async function enviarPushParaPerfis(profileIds: string[], payload: PushPayload) {
  const ids = [...new Set(profileIds.filter(Boolean))]
  if (ids.length === 0) return { sent: 0, failed: 0, error: 'Sem destinatários' }

  const { rows } = await db.query<SubscriptionRow>(
    `select id, profile_id, platform, endpoint, p256dh, auth, expo_token
       from push_subscriptions
      where profile_id = any($1::uuid[])`,
    [ids]
  )

  if (rows.length === 0) return { sent: 0, failed: 0, error: 'Sem subscrições' }

  const webOk = configureVapid()
  const expoMessages: Record<string, unknown>[] = []
  let sent = 0
  let failed = 0
  let lastError: string | null = null

  for (const sub of rows) {
    if (sub.expo_token) {
      expoMessages.push({
        to: sub.expo_token,
        title: payload.title,
        body: payload.body,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
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
    } catch (error) {
      failed += 1
      const statusCode = (error as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        await db.query('delete from push_subscriptions where id = $1', [sub.id]).catch(() => {})
      } else {
        lastError = errorText(error)
        console.error('Erro Web Push:', lastError)
      }
    }
  }

  if (expoMessages.length > 0) {
    const result = await sendExpoBatch(expoMessages)
    sent += result.ok
    failed += expoMessages.length - result.ok
    lastError = result.error

    if (result.invalidTokens.length > 0) {
      await db
        .query('delete from push_subscriptions where expo_token = any($1::text[])', [result.invalidTokens])
        .catch(() => {})
    }
  }

  return { sent, failed, error: lastError }
}

const MAX_PUSH_ATTEMPTS = 60

export async function despacharNotificacoesPendentes(limit = 200) {
  const { rows } = await db.query(
    `with pendentes as (
       select id
         from notifications
        where push_sent_at is null
          and push_attempts < $2
          and created_at >= now() - interval '1 day'
        order by created_at asc
        limit $1
        for update skip locked
     )
     update notifications n
        set push_attempts = n.push_attempts + 1
       from pendentes p
      where n.id = p.id
      returning n.id, n.profile_id, n.title, n.body, n.data, n.created_at, n.push_attempts`,
    [limit, MAX_PUSH_ATTEMPTS]
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

      if (result.sent > 0) {
        enviados += result.sent
        await db.query(
          `update notifications
              set push_sent_at = now(), push_last_error = null
            where id = $1`,
          [notification.id]
        )
      } else {
        const desistir = notification.push_attempts >= MAX_PUSH_ATTEMPTS
        await db.query(
          `update notifications
              set push_last_error = $2,
                  push_sent_at = case when $3 then now() else push_sent_at end
            where id = $1`,
          [notification.id, result.error || 'Não entregue', desistir]
        )
      }
    } catch (error) {
      console.error('Erro ao despachar notificação', notification.id, error)
      await db
        .query(
          `update notifications set push_last_error = $2 where id = $1`,
          [notification.id, errorText(error)]
        )
        .catch(() => {})
    }
  }

  return { processed: rows.length, enviados }
}
