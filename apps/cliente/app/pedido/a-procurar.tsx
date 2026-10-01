import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'

const RONDAS = [
  { ronda: 1, raioKm: 5, label: 'A procurar a 5 km...' },
  { ronda: 2, raioKm: 10, label: 'A alargar para 10 km...' },
  { ronda: 3, raioKm: 20, label: 'A alargar para 20 km...' },
]

export default function AProcurarMestreScreen() {
  const params = useLocalSearchParams<{
    categoriaId: string
    categoriaNome: string
    descricao: string
    referencia: string
    lat: string
    lng: string
  }>()

  const [rondaAtual, setRondaAtual] = useState(0)
  const [esgotado, setEsgotado] = useState(false)
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Animação de pulso
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [])

  // Simular progressão de rondas (em produção: Supabase Realtime)
  useEffect(() => {
    if (rondaAtual >= RONDAS.length) {
      setEsgotado(true)
      return
    }
    const timer = setTimeout(() => {
      setRondaAtual(prev => prev + 1)
    }, 8000) // 8s por ronda em demo; em produção são 60s (SOS) ou 5min (hoje)
    return () => clearTimeout(timer)
  }, [rondaAtual])

  if (esgotado) {
    return (
      <View style={styles.container}>
        <Text style={styles.esgotadoIcon}>😔</Text>
        <Text style={styles.esgotadoTitle}>Nenhum mestre disponível</Text>
        <Text style={styles.esgotadoDesc}>
          Não encontrámos nenhum {params.categoriaNome} disponível na tua zona neste momento.
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/pedido/orcamento')}>
          <Text style={styles.btnText}>Pedir orçamentos (Modo Agendado)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => router.back()}>
          <Text style={styles.btnOutlineText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Animação de radar */}
      <View style={styles.radarContainer}>
        <Animated.View style={[styles.radarOuter, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.radarMid, { transform: [{ scale: pulseAnim }], opacity: 0.6 }]} />
        <View style={styles.radarCenter}>
          <Text style={styles.radarEmoji}>📍</Text>
        </View>
      </View>

      <Text style={styles.titulo}>A procurar mestre</Text>
      <Text style={styles.subtitulo}>{params.categoriaNome}</Text>

      {/* Indicador de ronda */}
      <View style={styles.rondasContainer}>
        {RONDAS.map((r, i) => (
          <View key={r.ronda} style={styles.rondaRow}>
            <View style={[
              styles.rondaDot,
              i < rondaAtual && styles.rondaDotDone,
              i === rondaAtual && styles.rondaDotActive,
            ]} />
            <Text style={[
              styles.rondaLabel,
              i === rondaAtual && styles.rondaLabelActive,
              i < rondaAtual && styles.rondaLabelDone,
            ]}>
              {r.label}
            </Text>
            {i < rondaAtual && <Text style={styles.rondaCheck}>✓</Text>}
          </View>
        ))}
      </View>

      <Text style={styles.hint}>
        Assim que um mestre aceitar, verás o nome, a foto e o tempo estimado de chegada.
      </Text>

      <TouchableOpacity
        style={styles.btnCancel}
        onPress={() => {
          router.back()
        }}
      >
        <Text style={styles.btnCancelText}>Cancelar pedido</Text>
      </TouchableOpacity>
    </View>
  )
}

const TINTA = '#1A1A2E'
const PAPEL = '#F5F0E8'
const AMARELO = '#F2C94C'
const ZINCO = '#6B7280'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TINTA, alignItems: 'center', justifyContent: 'center', padding: 32 },
  radarContainer: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  radarOuter: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(242,201,76,0.08)', borderWidth: 1, borderColor: 'rgba(242,201,76,0.15)' },
  radarMid: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(242,201,76,0.12)', borderWidth: 1, borderColor: 'rgba(242,201,76,0.25)' },
  radarCenter: { width: 64, height: 64, borderRadius: 32, backgroundColor: AMARELO, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  radarEmoji: { fontSize: 28 },
  titulo: { fontSize: 26, fontWeight: '900', color: PAPEL, textAlign: 'center', letterSpacing: -0.5, marginBottom: 6 },
  subtitulo: { fontSize: 16, color: AMARELO, fontWeight: '700', marginBottom: 40 },
  rondasContainer: { width: '100%', gap: 16, marginBottom: 32 },
  rondaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rondaDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.15)' },
  rondaDotActive: { backgroundColor: AMARELO, width: 12, height: 12, borderRadius: 6 },
  rondaDotDone: { backgroundColor: '#4ADE80' },
  rondaLabel: { flex: 1, color: 'rgba(255,255,255,0.35)', fontSize: 14 },
  rondaLabelActive: { color: PAPEL, fontWeight: '700' },
  rondaLabelDone: { color: 'rgba(255,255,255,0.55)', textDecorationLine: 'line-through' },
  rondaCheck: { color: '#4ADE80', fontWeight: '900', fontSize: 14 },
  hint: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20, marginBottom: 40 },
  btnCancel: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  btnCancelText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 14 },
  // Ecrã esgotado
  esgotadoIcon: { fontSize: 56, marginBottom: 16 },
  esgotadoTitle: { fontSize: 22, fontWeight: '900', color: PAPEL, textAlign: 'center', marginBottom: 12 },
  esgotadoDesc: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  btnPrimary: { width: '100%', backgroundColor: AMARELO, borderRadius: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: '#fff', marginBottom: 12 },
  btnText: { color: TINTA, fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  btnOutline: { width: '100%', paddingVertical: 16, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center' },
  btnOutlineText: { color: PAPEL, fontWeight: '700', fontSize: 14 },
})
