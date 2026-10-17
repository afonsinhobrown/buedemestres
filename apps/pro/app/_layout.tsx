import { useEffect } from 'react'
import { Slot, router, usePathname } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useAuthStore } from '../lib/useAuthStore'

const queryClient = new QueryClient()

function HomeShortcut() {
  const pathname = usePathname()
  if (pathname === '/') return null

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

  useEffect(() => {
    initialize()
  }, [initialize])

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
    backgroundColor: '#F2C94C',
    borderWidth: 2,
    borderColor: '#1A1A2E',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  homeButtonText: { color: '#1A1A2E', fontSize: 12, fontWeight: '900' },
})
