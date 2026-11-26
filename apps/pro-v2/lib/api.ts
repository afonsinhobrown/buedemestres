import { Platform } from 'react-native'
import { supabase } from './supabase'

/**
 * Base do servidor web (Next.js) que expõe as rotas /api.
 * No browser usamos a mesma origem; nas apps nativas apontamos para a API pública.
 *
 * Sempre importar daqui em vez de ler `EXPO_PUBLIC_API_URL` diretamente:
 * se a variável não estiver definida no build nativo, um `fetch('/api/...')`
 * falha com "Network request failed".
 */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'web' ? '' : 'https://buedemestres.vercel.app')

/**
 * fetch autenticado para as APIs da plataforma.
 * Anexa o access token da sessão Supabase; o servidor valida o JWT.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = new Headers(init.headers)
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  const url = /^https?:\/\//i.test(path)
    ? path
    : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`

  return fetch(url, { ...init, headers })
}
