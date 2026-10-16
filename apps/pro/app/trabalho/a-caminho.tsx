import { View, Text, StyleSheet, TouchableOpacity, Linking, Image, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const MEIOS_TRANSPORTE = [
  { id: 'carro_proprio', label: '🚗 Carro Pessoal', etaText: 'Trânsito normal' },
  { id: 'chapa', label: '🚐 Chapa', etaText: 'Pode atrasar nas paragens' },
  { id: 'moto', label: '🏍️ Moto / Txopela', etaText: 'Mais rápido no trânsito' },
  { id: 'tpm', label: '🚌 TPM (Autocarro)', etaText: 'Horário de carreira' },
  { id: 'amigo', label: '🤝 Boleia / Amigo', etaText: 'A caminho' },
  { id: 'a_pe', label: '🚶 A pé', etaText: 'Proximidade directa' }
]

function parseWkbPoint(wkb: string | null | undefined): { lat: number; lng: number } | null {
  if (!wkb || typeof wkb !== 'string' || wkb.length < 50) return null
  try {
    const bytes = new Uint8Array(wkb.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
    const view = new DataView(bytes.buffer)
    const lng = view.getFloat64(9, true)
    const lat = view.getFloat64(17, true)
    if (isNaN(lat) || isNaN(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

export default function ProACaminhoScreen() {
  const params = useLocalSearchParams<{ jobId: string; categoriaNome: string; categoriaEmoji: string }>()
  const [estado, setEstado] = useState<'en_route' | 'arrived' | 'in_service'>('en_route')
  const [transporte, setTransporte] = useState<string>('carro_proprio')
  const [jobData, setJobData] = useState<any>(null)
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregarDadosReais() {
      if (!params.jobId) {
        setLoading(false)
        return
      }
      try {
        const { data: req } = await supabase
          .from('service_requests')
          .select('*, profiles:client_id(id, full_name, phone, avatar_url)')
          .eq('id', params.jobId)
          .maybeSingle()

        if (req) {
          setJobData(req)
          if (req.location) {
            const coords = parseWkbPoint(req.location)
            if (coords) setClientCoords(coords)
          }
        } else {
          const { data: j } = await supabase
            .from('jobs')
            .select('*, service_requests(*, profiles:client_id(id, full_name, phone, avatar_url))')
            .eq('id', params.jobId)
            .maybeSingle()

          if (j?.service_requests) {
            setJobData(j.service_requests)
            if (j.service_requests.location) {
              const coords = parseWkbPoint(j.service_requests.location)
              if (coords) setClientCoords(coords)
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar dados do trabalho:', err)
      } finally {
        setLoading(false)
      }
    }
    carregarDadosReais()
  }, [params.jobId])

  const abrirMapas = () => {
    if (clientCoords) {
      Linking.openURL(`https://maps.google.com/?q=${clientCoords.lat},${clientCoords.lng}`)
    } else {
      Linking.openURL(`https://maps.google.com/?q=-25.82898,32.58233`)
    }
  }

  const handleChegada = async () => {
    setEstado('arrived')
    if (params.jobId) {
      try {
        await supabase
          .from('jobs')
          .update({ status: 'arrived', arrived_at: new Date().toISOString() })
          .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
      } catch (e) {
        console.warn('Atualizar estado chegado:', e)
      }
    }
  }

  const handleProporPreco = () => {
    router.push({
      pathname: '/trabalho/propor-preco',
      params: { jobId: params.jobId, transporte }
    })
  }

  const transporteActual = MEIOS_TRANSPORTE.find(t => t.id === transporte) || MEIOS_TRANSPORTE[0]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.catEmoji}>{params.categoriaEmoji ?? '🔧'}</Text>
        <Text style={styles.headerTitle}>{jobData?.title || params.categoriaNome || 'Serviço Atribuído'}</Text>
        <View style={[styles.badge, estado === 'en_route' ? styles.badgeRoute : estado === 'arrived' ? styles.badgeArrived : styles.badgeService]}>
          <Text style={styles.badgeText}>
            {estado === 'en_route' ? `${transporteActual.label.split(' ')[0]} A caminho` : estado === 'arrived' ? '📍 Chegaste ao local' : '🔧 Em serviço'}
          </Text>
        </View>
      </View>

      {/* Meio de Deslocação */}
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
            ℹ️ O cliente é informado do meio ({transporteActual.label}) e da previsão de chegada no mapa.
          </Text>
        </View>
      )}

      {/* Card do Cliente com Dados Reais da Base de Dados */}
      <View style={styles.clienteCard}>
        {loading ? (
          <ActivityIndicator color="#F2C94C" />
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Image
                source={{ uri: jobData?.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' }}
                style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#F2C94C', backgroundColor: '#334155' }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.clienteLabel}>CLIENTE DO PEDIDO</Text>
                <Text style={styles.clienteNome}>
                  {jobData?.profiles?.full_name || 'Cliente Registado'}
                </Text>
              </View>
            </View>

            <Text style={styles.clienteRef}>
              📍 {jobData?.location_note || jobData?.address || 'Localização GPS indicada pelo cliente'}
            </Text>

            {jobData?.description && (
              <View style={styles.descricaoBox}>
                <Text style={styles.descricaoLabel}>DESCRIÇÃO DO PROBLEMA:</Text>
                <Text style={styles.descricaoTexto}>"{jobData.description}"</Text>
              </View>
            )}

            {clientCoords && (
              <Text style={styles.coordsText}>
                GPS: {clientCoords.lat.toFixed(5)}, {clientCoords.lng.toFixed(5)}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Navegar no Google Maps com coordenadas reais */}
      <TouchableOpacity style={styles.btnMapas} onPress={abrirMapas} activeOpacity={0.8}>
        <Text style={styles.btnMapasText}>🗺 Navegar até ao cliente no Mapa</Text>
      </TouchableOpacity>

      {/* Orçamento antes de sair ou ao chegar */}
      <TouchableOpacity style={styles.btnOrcamento} onPress={handleProporPreco} activeOpacity={0.8}>
        <Text style={styles.btnOrcamentoText}>💼 Propor Orçamento / Preço no Sistema</Text>
      </TouchableOpacity>

      {estado === 'en_route' && (
        <TouchableOpacity style={styles.btnPrimary} onPress={handleChegada} activeOpacity={0.8}>
          <Text style={styles.btnPrimaryText}>📍 Já cheguei ao local</Text>
        </TouchableOpacity>
      )}

      {estado === 'arrived' && (
        <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#2563EB', borderColor: '#60A5FA' }]} onPress={handleProporPreco} activeOpacity={0.8}>
          <Text style={styles.btnPrimaryText}>🔧 Diagnóstico Feito — Enviar Orçamento →</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A', padding: 20, paddingTop: 48 },
  header: { alignItems: 'center', marginBottom: 20 },
  catEmoji: { fontSize: 44, marginBottom: 6 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#F5F0E8', marginBottom: 8, textAlign: 'center' },
  badge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeRoute: { backgroundColor: 'rgba(242,201,76,0.15)', borderColor: '#F2C94C' },
  badgeArrived: { backgroundColor: 'rgba(74,222,128,0.15)', borderColor: '#4ADE80' },
  badgeService: { backgroundColor: 'rgba(96,165,250,0.15)', borderColor: '#60A5FA' },
  badgeText: { fontWeight: '800', color: '#F5F0E8', fontSize: 12 },
  clienteCard: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16 },
  clienteLabel: { fontSize: 10, fontWeight: '700', color: '#F2C94C', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  clienteNome: { fontSize: 18, fontWeight: '900', color: '#F5F0E8' },
  clienteRef: { fontSize: 14, color: '#38BDF8', lineHeight: 20, fontWeight: '600', marginTop: 4 },
  descricaoBox: { marginTop: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  descricaoLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', marginBottom: 4 },
  descricaoTexto: { fontSize: 13, color: '#E2E8F0', fontStyle: 'italic', lineHeight: 18 },
  coordsText: { fontSize: 11, color: '#94A3B8', marginTop: 8, fontFamily: 'monospace' },
  transporteCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: 'rgba(242,201,76,0.3)', marginBottom: 16 },
  transporteLabel: { fontSize: 11, fontWeight: '800', color: '#F2C94C', letterSpacing: 1.2, marginBottom: 8 },
  transporteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  transporteBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  transporteBtnAtivo: { backgroundColor: '#F2C94C', borderColor: '#F2C94C' },
  transporteBtnText: { color: '#F5F0E8', fontSize: 11, fontWeight: '700' },
  transporteBtnTextAtivo: { color: '#1A1A2E', fontWeight: '900' },
  transporteNota: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 15 },
  btnMapas: { backgroundColor: '#1E3A5F', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#60A5FA' },
  btnMapasText: { color: '#60A5FA', fontWeight: '800', fontSize: 14 },
  btnOrcamento: { backgroundColor: 'rgba(242,201,76,0.12)', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 10, borderWidth: 1.5, borderColor: '#F2C94C' },
  btnOrcamentoText: { color: '#F2C94C', fontWeight: '800', fontSize: 14 },
  btnPrimary: { backgroundColor: '#166534', borderRadius: 8, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: '#4ADE80' },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
})
