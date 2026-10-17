import { useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useAuthStore } from '@/lib/useAuthStore'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || ''

export default function ScanQrScreen() {
  const params = useLocalSearchParams<{ jobId?: string; phase?: string }>()
  const phase = params.phase === 'finish' ? 'finish' : 'start'
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const userId = user?.id || profile?.id || ''
  const [permission, requestPermission] = useCameraPermissions()
  const [processing, setProcessing] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const lockRef = useRef(false)

  const validar = async (payload: { token?: string; code?: string }) => {
    if (lockRef.current || !userId) return
    lockRef.current = true
    try {
      setProcessing(true)
      const res = await fetch(`${API_BASE}/api/jobs/qr/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          jobId: params.jobId,
          phase,
          clientId: userId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'QR inválido.')

      Alert.alert(
        phase === 'start' ? 'Serviço iniciado' : 'Serviço finalizado',
        phase === 'start'
          ? 'Identidade confirmada e serviço iniciado.'
          : 'Conclusão confirmada. Agora podes libertar o pagamento.',
        [{ text: 'OK', onPress: () => router.replace({ pathname: '/pedido/mestre-a-caminho', params: { jobId: params.jobId } }) }]
      )
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível validar o QR.')
      lockRef.current = false
    } finally {
      setProcessing(false)
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2444C8" />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Precisamos da câmara para ler o QR do mestre.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Permitir câmara</Text>
        </TouchableOpacity>
        <Text style={styles.manualTitle}>Ou introduz o código manual</Text>
        <TextInput
          style={styles.manualInput}
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="Código de 6 dígitos"
          autoCapitalize="characters"
          maxLength={6}
        />
        <TouchableOpacity style={styles.btn} onPress={() => validar({ code: manualCode })}>
          <Text style={styles.btnText}>Validar código</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const AnyCameraView = CameraView as any

  return (
    <View style={styles.container}>
      <AnyCameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }: any) => {
          if (!processing) validar({ token: data })
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.title}>
          {phase === 'start' ? 'Ler QR de início' : 'Ler QR de conclusão'}
        </Text>
        <Text style={styles.sub}>Aponta para o QR no telemóvel do mestre.</Text>
        <View style={styles.frame} />
        {processing && <ActivityIndicator color="#F2C94C" style={{ marginTop: 16 }} />}
        <View style={styles.manualBox}>
          <Text style={styles.manualTitle}>Código manual</Text>
          <TextInput
            style={styles.manualInput}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="XXXXXX"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            maxLength={6}
          />
          <TouchableOpacity style={styles.btn} onPress={() => validar({ code: manualCode })}>
            <Text style={styles.btnText}>Validar código</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#EDF0F2' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  sub: { color: '#FFC61A', fontSize: 13, marginTop: 4, textAlign: 'center' },
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: '#FFC61A', borderRadius: 16, marginTop: 24 },
  manualBox: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: 14, marginTop: 20, width: '100%', alignItems: 'center' },
  manualTitle: { color: '#12163A', fontWeight: '800', fontSize: 12, marginBottom: 8 },
  manualInput: { backgroundColor: '#F3F4F6', borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', width: '100%', textAlign: 'center', fontSize: 20, fontWeight: '900', color: '#12163A', paddingVertical: 8, marginBottom: 10 },
  btn: { backgroundColor: '#FFC61A', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  btnText: { color: '#12163A', fontWeight: '900', fontSize: 13 },
  cancelBtn: { marginTop: 16, padding: 10 },
  cancelText: { color: '#fff', fontWeight: '700' },
  permissionText: { color: '#12163A', fontSize: 14, textAlign: 'center', marginBottom: 14 },
})
