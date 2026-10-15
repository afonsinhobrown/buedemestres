import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState } from 'react'

const MEIOS_TRANSPORTE = [
  { id: 'carro_proprio', label: '🚗 Carro Pessoal', etaText: 'Trânsito normal' },
  { id: 'chapa', label: '🚐 Chapa', etaText: 'Pode atrasar nas paragens' },
  { id: 'moto', label: '🏍️ Moto / Txopela', etaText: 'Mais rápido no trânsito' },
  { id: 'tpm', label: '🚌 TPM (Autocarro)', etaText: 'Horário de carreira' },
  { id: 'amigo', label: '🤝 Boleia / Amigo', etaText: 'A caminho' },
  { id: 'a_pe', label: '🚶 A pé', etaText: 'Proximidade directa' }
]

export default function ProACaminhoScreen() {
  const params = useLocalSearchParams<{ jobId: string; categoriaNome: string; categoriaEmoji: string }>()
  const [estado, setEstado] = useState<'en_route' | 'arrived' | 'in_service'>('en_route')
  const [transporte, setTransporte] = useState<string>('carro_proprio')

  const abrirMapas = () => Linking.openURL('https://maps.google.com/?q=-25.9692,32.5732')

  const handleChegada = () => {
    setEstado('arrived')
  }

  const handleIniciarServico = () => {
    setEstado('in_service')
    router.push({ pathname: '/trabalho/propor-preco', params: { jobId: params.jobId, transporte } })
  }

  const transporteActual = MEIOS_TRANSPORTE.find(t => t.id === transporte) || MEIOS_TRANSPORTE[0]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.catEmoji}>{params.categoriaEmoji ?? '🔧'}</Text>
        <Text style={styles.headerTitle}>{params.categoriaNome ?? 'Mecânico'}</Text>
        <View style={[styles.badge, estado === 'en_route' ? styles.badgeRoute : estado === 'arrived' ? styles.badgeArrived : styles.badgeService]}>
          <Text style={styles.badgeText}>
            {estado === 'en_route' ? `${transporteActual.label.split(' ')[0]} A caminho` : estado === 'arrived' ? '📍 Chegaste' : '🔧 Em serviço'}
          </Text>
        </View>
      </View>

      {/* Seletor de Meio de Deslocação */}
      {estado === 'en_route' && (
        <View style={styles.transporteCard}>
          <Text style={styles.transporteLabel}>COMO TE ESTÁS A DESLOCAR?</Text>
          <View style={styles.transporteGrid}>
            {MEIOS_TRANSPORTE.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.transporteBtn, transporte === t.id && styles.transporteBtnAtivo]}
                onPress={() => setTransporte(t.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.transporteBtnText, transporte === t.id && styles.transporteBtnTextAtivo]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.transporteNota}>
            ℹ️ O cliente é informado do meio ({transporteActual.label}) e da previsão de chegada.
          </Text>
        </View>
      )}

      <View style={styles.clienteCard}>
        <Text style={styles.clienteLabel}>CLIENTE</Text>
        <Text style={styles.clienteNome}>António Cuamba</Text>
        <Text style={styles.clienteRef}>📍 Junto ao Mercado do Xipamanine, portão azul</Text>
      </View>

      <TouchableOpacity style={styles.btnMapas} onPress={abrirMapas}>
        <Text style={styles.btnMapasText}>🗺 Navegar até ao cliente</Text>
      </TouchableOpacity>

      {estado === 'en_route' && (
        <TouchableOpacity style={styles.btnPrimary} onPress={handleChegada}>
          <Text style={styles.btnPrimaryText}>📍 Cheguei ao local</Text>
        </TouchableOpacity>
      )}

      {estado === 'arrived' && (
        <TouchableOpacity style={styles.btnPrimary} onPress={handleIniciarServico}>
          <Text style={styles.btnPrimaryText}>🔧 Diagnostiquei — Propor preço →</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A', padding: 24, paddingTop: 56 },
  header: { alignItems: 'center', marginBottom: 32 },
  catEmoji: { fontSize: 52, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#F5F0E8', marginBottom: 12 },
  badge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  badgeRoute: { backgroundColor: 'rgba(242,201,76,0.15)', borderColor: '#F2C94C' },
  badgeArrived: { backgroundColor: 'rgba(74,222,128,0.15)', borderColor: '#4ADE80' },
  badgeService: { backgroundColor: 'rgba(96,165,250,0.15)', borderColor: '#60A5FA' },
  badgeText: { fontWeight: '800', color: '#F5F0E8', fontSize: 13 },
  clienteCard: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
  clienteLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  clienteNome: { fontSize: 18, fontWeight: '900', color: '#F5F0E8', marginBottom: 6 },
  clienteRef: { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20 },
  transporteCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: 'rgba(242,201,76,0.3)', marginBottom: 20 },
  transporteLabel: { fontSize: 11, fontWeight: '800', color: '#F2C94C', letterSpacing: 1.2, marginBottom: 10 },
  transporteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  transporteBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  transporteBtnAtivo: { backgroundColor: '#F2C94C', borderColor: '#F2C94C' },
  transporteBtnText: { color: '#F5F0E8', fontSize: 12, fontWeight: '700' },
  transporteBtnTextAtivo: { color: '#1A1A2E', fontWeight: '900' },
  transporteNota: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 16 },
  btnMapas: { backgroundColor: '#1E3A5F', borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#60A5FA' },
  btnMapasText: { color: '#60A5FA', fontWeight: '800', fontSize: 14 },
  btnPrimary: { backgroundColor: '#166534', borderRadius: 8, paddingVertical: 20, alignItems: 'center', borderWidth: 2, borderColor: '#4ADE80' },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
})
