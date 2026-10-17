import { NextResponse } from 'next/server'
import { despacharNotificacoesPendentes } from '@/lib/push'

function authorized(request: Request) {
  const secret = process.env.PUSH_DISPATCH_SECRET
  if (!secret) return false
  const header = request.headers.get('x-push-secret')
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return header === secret || bearer === secret
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const result = await despacharNotificacoesPendentes()
  return NextResponse.json({ ok: true, ...result })
}

export async function POST(request: Request) {
  return run(request)
}

export async function GET(request: Request) {
  return run(request)
}
