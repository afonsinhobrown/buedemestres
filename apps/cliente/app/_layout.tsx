import { useEffect } from 'react'
import { Slot, router, usePathname } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useAuthStore } from '@/lib/useAuthStore'

const queryClient = new QueryClient()

function HomeShortcut() {
  const pathname = usePathname()
  if (pathname === '/' || pathname === '/entrar' || pathname === '/(auth)/entrar') return null

  return (
    <TouchableOpacity
      style={styles.homeButton}
      onPress={() => router.replace('/')}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Voltar à tela principal"
    >
      <Text style={styles.homeButtonText}>🏠 Início</Text>
    </TouchableOpacity>
  )
}

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize)
  const initialized = useAuthStore((s) => s.initialized)
  const session = useAuthStore((s) => s.session)
  const pathname = usePathname()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!initialized) return
    const isAuthRoute = pathname === '/entrar' || pathname === '/(auth)/entrar'
    if (!session && !isAuthRoute) router.replace('/entrar')
    if (session && isAuthRoute) router.replace('/')
  }, [initialized, session, pathname])

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.root}>
        <Slot />
        <HomeShortcut />
      </View>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  homeButton: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 14 : 46,
    right: 14,
    zIndex: 999,
    backgroundColor: '#12163A',
    borderWidth: 2,
    borderColor: '#FFC61A',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  homeButtonText: { color: '#FFC61A', fontSize: 12, fontWeight: '900' },
})
