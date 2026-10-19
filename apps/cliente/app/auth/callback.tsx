import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackScreen() {
  const { code, sb_flow_id } = useLocalSearchParams<{ code?: string; sb_flow_id?: string }>()
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!code) {
      setErro('Link de confirmação inválido ou já utilizado.')
      return
    }
    supabase.auth
      .exchangeCodeForSession(code, sb_flow_id ? { flowId: sb_flow_id } : undefined)
      .then(({ error }) => {
        if (error) {
          setErro('O teu email foi confirmado. Volta a entrar com o teu email e senha.')
        } else {
          router.replace('/')
        }
      })
      .catch(() => setErro('O teu email foi confirmado. Volta a entrar com o teu email e senha.'))
  }, [code, sb_flow_id])

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF0F2" />
      <View style={styles.container}>
        {erro ? (
          <>
            <Text style={styles.erroTitulo}>Confirmação</Text>
            <Text style={styles.erroTexto}>{erro}</Text>
            <TouchableOpacity style={styles.btn} onPress={() => router.replace('/entrar')}>
              <Text style={styles.btnText}>Ir para o login</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#2444C8" />
            <Text style={styles.texto}>A confirmar o seu email…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EDF0F2' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  texto: { marginTop: 16, color: '#12163A', fontSize: 16, fontWeight: '600' },
  erroTitulo: { color: '#12163A', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  erroTexto: { color: '#5B6472', fontSize: 14, textAlign: 'center' },
  btn: { backgroundColor: '#2444C8', borderRadius: 4, paddingVertical: 14, paddingHorizontal: 32, marginTop: 24 },
  btnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
})
