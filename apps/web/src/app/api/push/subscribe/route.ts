import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/session'

export async function GET() {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ authenticated: false, subscribed: false })

  const { rows } = await db.query(
    `select count(*)::int as total from push_subscriptions where profile_id = $1 and platform = 'web'`,
    [session.userId]
  )
  return NextResponse.json({ authenticated: true, subscribed: (rows[0]?.total || 0) > 0 })
}

export async function POST(request: Request) {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const endpoint = String(body?.endpoint || '')
  const p256dh = String(body?.keys?.p256dh || '')
  const auth = String(body?.keys?.auth || '')

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Subscrição inválida' }, { status: 400 })
  }

  await db.query(
    `insert into push_subscriptions(profile_id, platform, endpoint, p256dh, auth, user_agent)
     values ($1, 'web', $2, $3, $4, $5)
     on conflict (profile_id, endpoint)
     do update set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, updated_at = now()`,
    [session.userId, endpoint, p256dh, auth, request.headers.get('user-agent') || null]
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let endpoint = ''
  try {
    const body = await request.json()
    endpoint = String(body?.endpoint || '')
  } catch {
    // sem corpo: remove todas as subscrições web do utilizador
  }

  if (endpoint) {
    await db.query('delete from push_subscriptions where profile_id = $1 and endpoint = $2', [
      session.userId,
      endpoint,
    ])
  } else {
    await db.query("delete from push_subscriptions where profile_id = $1 and platform = 'web'", [
      session.userId,
    ])
  }

  return NextResponse.json({ ok: true })
}
