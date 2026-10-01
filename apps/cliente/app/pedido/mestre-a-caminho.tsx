import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'

// Este ecrã recebe os dados do mestre que aceitou o pedido (via Realtime ou params de demo)
export default function MestreACaminhoScreen() {
  const params = useLocalSearchParams<{
    jobId: string
    mestreNome: string
    mestreFoto: string
    mestreNota: string
    mestreTelefone: string
    distanciaM: string
    etaMinutos: string
    categoriaEmoji: string
  }>()

  // Valores de demo caso não haja params reais
  const mestreNome = params.mestreNome ?? 'Armindo Machava'
  const mestreNota = params.mestreNota ?? '4.8'
  const etaMinutos = params.etaMinutos ?? '8'
  const distanciaM = params.distanciaM ?? '2300'
  const categoriaEmoji = params.categoriaEmoji ?? '🔧'

  const handleChamar = () => {
    if (params.mestreTelefone) {
      Linking.openURL(`tel:${params.mestreTelefone}`)
    } else {
      Alert.alert('Contacto', 'O contacto do mestre estará disponível quando chegar.')
    }
  }

  const handleWhatsApp = () => {
    const num = params.mestreTelefone?.replace(/\D/g, '')
    if (num) Linking.openURL(`https://wa.me/258${num}`)
  }

  const handleChegar = () => {
    router.push({
      pathname: '/pedido/proposta-preco',
      params: { jobId: params.jobId, mestreNome, categoriaEmoji },
    })
  }

  return (
    <View style={styles.container}>
      {/* Mapa placeholder (MapLibre/react-native-maps será integrado aqui) */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderText}>🗺️</Text>
        <Text style={styles.mapPlaceholderSub}>Mapa de acompanhamento</Text>
        <Text style={styles.mapPlaceholderHint}>(MapLibre + OSM na versão final)</Text>

        {/* Mini-placa do mestre no mapa */}
        <View style={styles.mestrePlacaMap}>
          <Text style={styles.mestrePlacaMapEmoji}>{categoriaEmoji}</Text>
        </View>
      </View>

      {/* Painel inferior arrastável (simplificado) */}
      <View style={styles.painel}>
        {/* Linha de drag */}
        <View style={styles.dragHandle} />

        {/* Info do mestre */}
        <View style={styles.mestreRow}>
          <View style={styles.mestreAvatar}>
            <Text style={styles.mestreAvatarEmoji}>{categoriaEmoji}</Text>
          </View>
          <View style={styles.mestreInfo}>
            <Text style={styles.mestreNome}>{mestreNome}</Text>
            <Text style={styles.mestreNota}>⭐ {mestreNota} · Verificado ✓</Text>
          </View>
        </View>

        {/* ETA */}
        <View style={styles.etaCard}>
          <View style={styles.etaItem}>
            <Text style={styles.etaValor}>{etaMinutos} min</Text>
            <Text style={styles.etaLabel}>Tempo estimado</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValor}>{(parseInt(distanciaM) / 1000).toFixed(1)} km</Text>
            <Text style={styles.etaLabel}>Distância</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValor}>A caminho</Text>
            <Text style={styles.etaLabel}>Estado</Text>
          </View>
        </View>

        {/* Botões de contacto */}
        <View style={styles.contactoRow}>
          <TouchableOpacity style={styles.btnContacto} onPress={handleChamar}>
            <Text style={styles.btnContactoEmoji}>📞</Text>
            <Text style={styles.btnContactoText}>Ligar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnContacto, styles.btnWhatsApp]} onPress={handleWhatsApp}>
            <Text style={styles.btnContactoEmoji}>💬</Text>
            <Text style={styles.btnContactoText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.aviso}>
          O valor será combinado e pago na plataforma quando o mestre chegar.
        </Text>

        {/* Botão de desenvolvimento para testar o próximo ecrã */}
        <TouchableOpacity style={styles.btnDev} onPress={handleChegar}>
          <Text style={styles.btnDevText}>[DEV] Simular chegada do mestre →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const TINTA = '#1A1A2E'
const PAPEL = '#F5F0E8'
const AMARELO = '#F2C94C'
const ZINCO = '#6B7280'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8E4D8' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D4CFB8', position: 'relative' },
  mapPlaceholderText: { fontSize: 56, marginBottom: 8 },
  mapPlaceholderSub: { fontSize: 16, color: TINTA, fontWeight: '700' },
  mapPlaceholderHint: { fontSize: 11, color: ZINCO, marginTop: 4 },
  mestrePlacaMap: {
    position: 'absolute', top: '35%', left: '50%',
    width: 48, height: 48, borderRadius: 8, backgroundColor: TINTA,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: AMARELO,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  mestrePlacaMapEmoji: { fontSize: 22 },
  painel: { backgroundColor: PAPEL, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, borderTopWidth: 2, borderColor: TINTA },
  dragHandle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  mestreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  mestreAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: TINTA, alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 2, borderColor: AMARELO },
  mestreAvatarEmoji: { fontSize: 26 },
  mestreInfo: { flex: 1 },
  mestreNome: { fontSize: 18, fontWeight: '900', color: TINTA, marginBottom: 4 },
  mestreNota: { fontSize: 13, color: ZINCO, fontWeight: '600' },
  etaCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  etaItem: { flex: 1, alignItems: 'center' },
  etaValor: { fontSize: 18, fontWeight: '900', color: TINTA, marginBottom: 2 },
  etaLabel: { fontSize: 11, color: ZINCO, textTransform: 'uppercase', letterSpacing: 0.5 },
  etaDivider: { width: 1, backgroundColor: '#E5E7EB' },
  contactoRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  btnContacto: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 6, borderWidth: 2, borderColor: TINTA, backgroundColor: '#fff' },
  btnWhatsApp: { backgroundColor: '#25D366', borderColor: '#25D366' },
  btnContactoEmoji: { fontSize: 18 },
  btnContactoText: { fontWeight: '800', fontSize: 14, color: TINTA },
  aviso: { fontSize: 12, color: ZINCO, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  btnDev: { padding: 12, backgroundColor: '#FEF3C7', borderRadius: 6, borderWidth: 1, borderColor: '#F59E0B', alignItems: 'center' },
  btnDevText: { fontSize: 12, color: '#92400E', fontWeight: '700' },
})
