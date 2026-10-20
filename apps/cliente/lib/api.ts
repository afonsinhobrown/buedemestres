import { Platform } from 'react-native'

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
