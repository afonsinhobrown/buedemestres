import { useEffect } from 'react'
import { Slot, router, usePathname } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { View, StyleSheet, AppState, Platform } from 'react-native'
import { useAuthStore } from '../lib/useAuthStore'
import { registerPushToken } from '../lib/push'
import { BottomNav, type NavItem } from '../components/v2'
import { colors, shadows } from '../lib/theme'

const queryClient = new QueryClient()

const NAV_ITEMS: NavItem[] = [
  { label: 'Início', icon: '⌂', href: '/' },
  { label: 'Trabalhos', icon: '▤', href: '/trabalhos' },
  { label: 'Carteira', icon: '◫', href: '/carteira' },
  { label: 'Conta', icon: '☺', href: '/perfil' },
]

const MAIN_ROUTES = new Set(['/', '/trabalhos', '/carteira', '/perfil'])

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize)
  const initialized = useAuthStore((s) => s.initialized)
  const session = useAuthStore((s) => s.session)
  const pathname = usePathname()
  const showNav = MAIN_ROUTES.has(pathname)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!initialized) return
    if (!session && pathname !== '/entrar' && pathname !== '/auth/callback') router.replace('/entrar')
    if (session && pathname === '/entrar') router.replace('/')
  }, [initialized, session, pathname])

  useEffect(() => {
    if (!session?.user?.id) return

    registerPushToken().catch(() => {})

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') registerPushToken().catch(() => {})
    })

    return () => subscription.remove()
  }, [session?.user?.id])

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.stage}>
        <View style={[styles.frame, showNav && styles.frameWithNav]}>
          <Slot />
          {showNav ? <BottomNav items={NAV_ITEMS} /> : null}
        </View>
      </View>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Platform.OS === 'web' ? '#E7EBF1' : colors.paper,
  },
  frame: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.paper,
    ...(Platform.OS === 'web'
      ? {
          maxWidth: 480,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: colors.line,
          ...shadows.floating,
        }
      : null),
  },
  frameWithNav: { paddingBottom: 86 },
})
