import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { SessionPayload } from '@/types/database'

const SESSION_COOKIE = 'bdm_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

function getEncodedKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET não definido')
  return new TextEncoder().encode(secret)
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getEncodedKey())
}

export async function decrypt(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(
  userId: string,
  role: SessionPayload['role']
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const token = await encrypt({ userId, role, expiresAt })
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function updateSession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  const payload = await decrypt(token)
  if (!payload || !token) return

  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/** Verifica sessão e devolve o payload; redireciona para /entrar se inválida */
export const verifySession = cache(async (): Promise<SessionPayload> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  const payload = await decrypt(token)
  if (!payload?.userId) redirect('/entrar')
  return payload
})

/** Devolve o payload sem redirecionar (páginas públicas) */
export const getOptionalSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  return decrypt(token)
})
