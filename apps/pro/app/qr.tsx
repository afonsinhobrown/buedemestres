import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || ''

export default function QrScreen() {
  const params = useLocalSearchParams<{ jobId?: string; phase?: string }>()
  const jobId = params.jobId || ''
  const phase = params.phase === 'finish' ? 'finish' : 'start'
  const provider = useAuthStore((s) => s.providerProfile)
  const providerId = provider?.profile_id as string | undefined

  const [loading, setLoading] = useState(true)
  const [qr, setQr] = useState<{ qrDataUrl: string; code: string; expiresAt: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const handledRef = useRef(false)

  const gerar = useCallback(async () => {
    if (!jobId || !providerId) {
      setError('Perfil de mestre não encontrado.')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      handledRef.current = false
      const res = await fetch(`${API_BASE}/api/jobs/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, phase, providerId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível gerar o QR.')
      setQr(data)
    } catch (err: any) {
      setError(err.message || 'Falha ao gerar QR.')
    } finally {
      setLoading(false)
    }
  }, [jobId, phase, providerId])

  useEffect(() => {
    gerar()
  }, [gerar])

  useEffect(() => {
    if (!jobId) return
    const timer = setInterval(async () => {
      const { data: job } = await supabase
        .from('jobs')
        .select('status')
        .or(`id.eq.${jobId},request_id.eq.${jobId}`)
        .maybeSingle()
      if (!job || handledRef.current) return

      if (phase === 'start' && job.status === 'in_service') {
        handledRef.current = true
        Alert.alert('Serviço iniciado', 'O cliente validou o QR. Já podes executar o trabalho.', [
          { text: 'Continuar', onPress: () => router.replace({ pathname: '/trabalho/em-curso', params: { jobId } }) },
        ])
      }
      if (phase === 'finish' && job.status === 'awaiting_confirmation') {
        handledRef.current = true
        Alert.alert('Serviço finalizado', 'O cliente validou o QR de conclusão.', [
          { text: 'OK', onPress: () => router.replace('/') },
        ])
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [jobId, phase])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{phase === 'start' ? 'QR de Início' : 'QR de Conclusão'}</Text>
      <Text style={styles.sub}>
        Mostra este código ao cliente para {phase === 'start' ? 'confirmar a identidade e iniciar' : 'confirmar a conclusão'}.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#F2C94C" style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={gerar}>
            <Text style={styles.btnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : qr ? (
        <View style={styles.qrBox}>
          <Image source={{ uri: qr.qrDataUrl }} style={styles.qrImage} />
          <Text style={styles.codeLabel}>CÓDIGO MANUAL</Text>
          <Text style={styles.code}>{qr.code}</Text>
          <Text style={styles.expiry}>
            Válido até {new Date(qr.expiresAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={gerar}>
            <Text style={styles.btnText}>Gerar novo QR</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A', padding: 24, paddingTop: 56, alignItems: 'center' },
  title: { color: '#F5F0E8', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  sub: { color: '#F2C94C', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 18 },
  qrBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center' },
  qrImage: { width: 280, height: 280 },
  codeLabel: { color: '#6B7280', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 10 },
  code: { color: '#12163A', fontSize: 30, fontWeight: '900', letterSpacing: 4 },
  expiry: { color: '#6B7280', fontSize: 12, marginTop: 4, marginBottom: 12 },
  btn: { backgroundColor: '#F2C94C', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  btnText: { color: '#1A1A2E', fontWeight: '900', fontSize: 13 },
  errorBox: { marginTop: 30, alignItems: 'center' },
  errorText: { color: '#FCA5A5', fontSize: 13, textAlign: 'center', marginBottom: 12 },
})
