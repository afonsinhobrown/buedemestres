import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'

const OFERTA_EXPIRA_SEG = 60

export default function OfertaPedidoScreen() {
  const params = useLocalSearchParams<{
    offerId: string; categoriaEmoji: string; categoriaNome: string
    descricao: string; distanciaM: string; etaSeg: string; fotos: string
  }>()

  const [segundos, setSegundos] = useState(OFERTA_EXPIRA_SEG)
  const [respondido, setRespondido] = useState(false)
  const barraAnim = useRef(new Animated.Value(1)).current

  // Contagem regressiva
  useEffect(() => {
    Animated.timing(barraAnim, { toValue: 0, duration: OFERTA_EXPIRA_SEG * 1000, useNativeDriver: false }).start()
    const iv = setInterval(() => {
      setSegundos(s => {
        if (s <= 1) { clearInterval(iv); router.back(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  const handleAceitar = () => {
    setRespondido(true)
    // TODO: chamar accept_offer() via Supabase RPC
    router.replace({ pathname: '/trabalho/a-caminho', params: { jobId: 'demo', ...params } })
  }

  const handleRecusar = () => {
    Alert.alert('Recusar oferta?', 'Recusas reduzem o teu índice de fiabilidade.', [
      { text: 'Cancelar' },
      { text: 'Recusar', style: 'destructive', onPress: () => router.back() }
    ])
  }

  const distKm = ((parseInt(params.distanciaM ?? '3000')) / 1000).toFixed(1)
  const etaMin = Math.round(parseInt(params.etaSeg ?? '480') / 60)

  return (
    <View style={styles.container}>
      {/* Barra de contagem */}
      <Animated.View style={[styles.barra, { scaleX: barraAnim, backgroundColor: segundos > 20 ? '#F2C94C' : '#EF4444' }]} />

      <View style={styles.timer}>
        <Text style={[styles.timerNum, { color: segundos > 20 ? '#F2C94C' : '#EF4444' }]}>{segundos}s</Text>
        <Text style={styles.timerLabel}>para expirar</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.catEmoji}>{params.categoriaEmoji ?? '🔧'}</Text>
        <Text style={styles.catNome}>{params.categoriaNome ?? 'Mecânico'}</Text>
        <Text style={styles.descricao}>{params.descricao ?? 'Motor não arranca. Bateria em dia.'}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaValor}>{distKm} km</Text>
            <Text style={styles.metaLabel}>Distância</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Text style={styles.metaValor}>{etaMin} min</Text>
            <Text style={styles.metaLabel}>Tempo chegada</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Text style={styles.metaValor}>🔴 SOS</Text>
            <Text style={styles.metaLabel}>Urgência</Text>
          </View>
        </View>
      </View>

      <View style={styles.btns}>
        <TouchableOpacity style={styles.btnAceitar} onPress={handleAceitar} disabled={respondido}>
          <Text style={styles.btnAceitarText}>✓ Aceitar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnRecusar} onPress={handleRecusar} disabled={respondido}>
          <Text style={styles.btnRecusarText}>✕ Recusar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E', padding: 24, paddingTop: 0 },
  barra: { height: 5, width: '100%', marginBottom: 24, transformOrigin: 'left' },
  timer: { alignItems: 'center', marginBottom: 32 },
  timerNum: { fontSize: 64, fontWeight: '900', lineHeight: 68 },
  timerLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 32, alignItems: 'center' },
  catEmoji: { fontSize: 52, marginBottom: 8 },
  catNome: { fontSize: 22, fontWeight: '900', color: '#F5F0E8', marginBottom: 10 },
  descricao: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  metaRow: { flexDirection: 'row', width: '100%' },
  metaItem: { flex: 1, alignItems: 'center' },
  metaValor: { fontSize: 16, fontWeight: '900', color: '#F2C94C', marginBottom: 4 },
  metaLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  btns: { gap: 12 },
  btnAceitar: { backgroundColor: '#166534', borderRadius: 8, paddingVertical: 22, alignItems: 'center', borderWidth: 2, borderColor: '#4ADE80' },
  btnAceitarText: { color: '#fff', fontWeight: '900', fontSize: 18, textTransform: 'uppercase', letterSpacing: 2 },
  btnRecusar: { backgroundColor: 'transparent', borderRadius: 8, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  btnRecusarText: { color: 'rgba(255,255,255,0.45)', fontWeight: '700', fontSize: 15 },
})
