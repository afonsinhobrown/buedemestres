import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { decrypt } from '@/lib/session'
import type { SessionPayload } from '@/types/database'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mhipgiiwcsuhtsnbpttv.supabase.co'

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oaXBnaWl3Y3N1aHRzbmJwdHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTIwODAsImV4cCI6MjEwNjc2ODA4MH0.U6hNtWFzjMc1NXndSJurHDtSTTIFhrPlnHgGswJrUQs'

export type ApiActor = {
  userId: string
  role: SessionPayload['role']
  source: 'web' | 'supabase'
}

type ActorResult =
  | { actor: ApiActor; response: null }
  | { actor: null; response: NextResponse }

const tokenCache = new Map<string, { actor: ApiActor; expiresAt: number }>()

export function isStaffRole(role: string): boolean {
  return ['support', 'moderator', 'finance', 'admin', 'superadmin'].includes(role)
}

async function getSupabaseActor(token: string): Promise<ApiActor | null> {
  const cached = tokenCache.get(token)
  if (cached && cached.expiresAt > Date.now()) return cached.actor

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })

    if (!response.ok) return null
    const user = (await response.json()) as { id?: string }
    if (!user?.id) return null

    const { rows } = await db.query<{ role: SessionPayload['role']; is_active: boolean }>(
      `select role, is_active from profiles where id = $1 limit 1`,
      [user.id]
    )
    const profile = rows[0]
    if (!profile?.is_active) return null

    const actor: ApiActor = {
      userId: user.id,
      role: profile.role,
      source: 'supabase',
    }
    tokenCache.set(token, { actor, expiresAt: Date.now() + 60_000 })
    return actor
  } catch {
    return null
  }
}

/** Valida cookie de sessão web ou Bearer token Supabase. */
export async function getApiActor(request: Request): Promise<ApiActor | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('bdm_session')?.value
  if (sessionToken) {
    const payload = await decrypt(sessionToken)
    if (payload?.userId) {
      return { userId: payload.userId, role: payload.role, source: 'web' }
    }
  }

  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  return getSupabaseActor(match[1].trim())
}

export async function requireApiActor(request: Request): Promise<ActorResult> {
  const actor = await getApiActor(request)
  if (!actor) {
    return {
      actor: null,
      response: NextResponse.json(
        { ok: false, error: 'Não autenticado.' },
        { status: 401 }
      ),
    }
  }
  return { actor, response: null }
}

export type ApiJob = {
  id: string
  request_id: string | null
  client_id: string
  provider_id: string
  status: string
}

/** Procura o job por id ou request_id e valida o acesso do actor. */
export async function requireJobAccess(
  request: Request,
  identifier: string,
  mode: 'client' | 'provider' | 'either' = 'either'
): Promise<{ job: ApiJob; actor: ApiActor; response: null } | { job: null; actor: null; response: NextResponse }> {
  const auth = await requireApiActor(request)
  if (!auth.actor) return { job: null, actor: null, response: auth.response }

  const { rows } = await db.query<ApiJob>(
    `select id, request_id, client_id, provider_id, status
       from jobs
      where id::text = $1 or request_id::text = $1
      limit 1`,
    [identifier]
  )
  const job = rows[0]
  if (!job) {
    return {
      job: null,
      actor: null,
      response: NextResponse.json(
        { ok: false, error: 'Trabalho não encontrado.' },
        { status: 404 }
      ),
    }
  }

  if (isStaffRole(auth.actor.role)) {
    return { job, actor: auth.actor, response: null }
  }

  const allowed =
    mode === 'client'
      ? job.client_id === auth.actor.userId
      : mode === 'provider'
        ? job.provider_id === auth.actor.userId
        : job.client_id === auth.actor.userId || job.provider_id === auth.actor.userId

  if (!allowed) {
    return {
      job: null,
      actor: null,
      response: NextResponse.json(
        { ok: false, error: 'Sem permissão para este trabalho.' },
        { status: 403 }
      ),
    }
  }

  return { job, actor: auth.actor, response: null }
}
