import { View, Text, StyleSheet, TouchableOpacity, Linking, Image, ActivityIndicator, ScrollView } from 'react-native'
import { Alert } from '../../lib/alertCompat'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect } from 'react'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase'
import { loadSandboxSettings } from '../../lib/sandbox'
import MapaTracking from '../../components/MapaTracking'
import {
  parseGeoPoint,
  distanceMeters,
  canConfirmArrival,
  canConfirmArrivalInSandbox,
  MAX_ARRIVAL_DISTANCE_M,
  type GeoPoint,
} from '../../lib/geo'

function formatarDistancia(metros: number): string {
  return metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toFixed(1)} km`
}

function getCurrentPositionComTimeout(timeoutMs = 15000): Promise<Location.LocationObject | null> {
  return Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
}

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
  const params = useLocalSearchParams<{ jobId: string; categoriaNome?: string; categoriaEmoji?: string; valorAcordado?: string }>()
  
  // Estados: 'selecionar_transporte' -> 'en_route' -> 'arrived'
  const [fase, setFase] = useState<'selecionar_transporte' | 'en_route' | 'arrived'>('selecionar_transporte')
  const [transporte, setTransporte] = useState<string>('carro_proprio')
  const [jobData, setJobData] = useState<any>(null)
  const [jobRecord, setJobRecord] = useState<{ id: string; request_id: string | null; status: string; transport_mode: string | null } | null>(null)
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [providerCoords, setProviderCoords] = useState<GeoPoint | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [isConfirmingArrival, setIsConfirmingArrival] = useState(false)
  const [sandboxActive, setSandboxActive] = useState(false)

  useEffect(() => {
    let active = true
    loadSandboxSettings()
      .then((settings) => {
        if (active) setSandboxActive(settings.active)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    async function carregarDadosReais() {
      if (!params.jobId) {
        setLoading(false)
        return
      }
      try {
        const { data: j } = await supabase
          .from('jobs')
          .select('id, request_id, status, transport_mode, service_requests(*, profiles:client_id(id, full_name, phone, avatar_url))')
          .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
          .maybeSingle()

        if (j) {
          setJobRecord({
            id: j.id,
            request_id: j.request_id,
            status: j.status,
            transport_mode: j.transport_mode,
          })
          if (j.transport_mode) setTransporte(j.transport_mode)

          if (j.status === 'en_route') {
            setFase('en_route')
          } else if (j.status === 'arrived') {
            setFase('arrived')
          } else if (j.status === 'in_service') {
            router.replace({ pathname: '/trabalho/em-curso', params: { jobId: params.jobId } })
          } else if (['awaiting_confirmation', 'completed', 'cancelled', 'disputed'].includes(j.status)) {
            router.replace('/trabalhos')
          } else {
            setFase('selecionar_transporte')
          }

          const req = Array.isArray(j.service_requests) ? j.service_requests[0] : j.service_requests
          if (req) {
            setJobData(req)
            if (req.location) {
              const coords = parseGeoPoint(req.location)
              if (coords) setClientCoords(coords)
            }
          }
        } else {
          const { data: req } = await supabase
            .from('service_requests')
            .select('*, profiles:client_id(id, full_name, phone, avatar_url)')
            .eq('id', params.jobId)
            .maybeSingle()

          if (req) {
            setJobData(req)
            if (req.location) {
              const coords = parseGeoPoint(req.location)
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

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null
    let mounted = true

    const iniciar = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setLocationError('Permissão de localização negada. Abre as definições para partilhar a tua posição.')
        return
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      if (mounted && current) {
        const point = { lat: current.coords.latitude, lng: current.coords.longitude }
        setProviderCoords(point)
        await enviarPosicao(point, current.coords.heading)
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 8000,
          distanceInterval: 10,
        },
        async (position) => {
          const point = { lat: position.coords.latitude, lng: position.coords.longitude }
          if (!mounted) return
          setProviderCoords(point)
          await enviarPosicao(point, position.coords.heading)
        }
      )
    }

    const enviarPosicao = async (point: GeoPoint, heading: number | null) => {
      if (!params.jobId) return
      try {
        await supabase
          .from('jobs')
          .update({
            provider_lat: point.lat,
            provider_lng: point.lng,
            provider_heading: Number.isFinite(heading as number) ? heading : null,
            location_updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
      } catch (e) {
        console.warn('Erro ao enviar posição:', e)
      }
    }

    iniciar()

    return () => {
      mounted = false
      subscription?.remove()
    }
  }, [params.jobId])

  const abrirMapas = () => {
    if (clientCoords) {
      Linking.openURL(`https://maps.google.com/?q=${clientCoords.lat},${clientCoords.lng}`)
    } else {
      Linking.openURL(`https://maps.google.com/?q=-25.82898,32.58233`)
    }
  }

  // 1. Iniciar deslocação após pagamento confirmado
  const handleIniciarDeslocacao = async () => {
    if (!params.jobId) return
    try {
      const agora = new Date().toISOString()
      const { data: updated, error } = await supabase
        .from('jobs')
        .update({
          status: 'en_route',
          transport_mode: transporte,
          updated_at: agora,
        })
        .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
        .in('status', ['scheduled', 'requested', 'accepted', 'price_proposed', 'puxado', 'price_agreed', 'en_route'])
        .select('id, request_id')
        .maybeSingle()

      if (error) throw error

      if (!updated) {
        const { data: atual } = await supabase
          .from('jobs')
          .select('status')
          .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
          .maybeSingle()

        if (atual?.status === 'en_route') {
          setFase('en_route')
        } else if (atual?.status === 'arrived') {
          setFase('arrived')
        } else if (atual?.status === 'in_service') {
          router.replace({ pathname: '/trabalho/em-curso', params: { jobId: params.jobId } })
        } else {
          Alert.alert('Estado inválido', 'Este serviço já não pode ser iniciado a partir daqui.')
        }
        return
      }

      setFase('en_route')

      const requestId = updated.request_id || jobRecord?.request_id
      if (requestId) {
        await supabase
          .from('service_requests')
          .update({ status: 'accepted', updated_at: agora })
          .eq('id', requestId)
          .in('status', ['open', 'in_negotiation', 'accepted', 'price_proposed', 'puxado'])
      }
    } catch (e) {
      console.warn('Erro ao iniciar deslocação:', e)
      Alert.alert('Erro', 'Não foi possível iniciar a deslocação. Tenta novamente.')
    }
  }

  // 2. Informar chegada ao local (fora do sandbox, só dentro do raio de 200 m)
  const registarChegada = async () => {
    setFase('arrived')
    if (params.jobId) {
      try {
        await supabase
          .from('jobs')
          .update({
            status: 'arrived',
            arrived_at: new Date().toISOString()
          })
          .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
          .in('status', ['en_route', 'arrived'])
      } catch (e) {
        console.warn('Atualizar estado chegado:', e)
      }
    }
  }

  const confirmarChegadaNoLocal = async () => {
    setIsConfirmingArrival(true)
    try {
      await registarChegada()
    } finally {
      setIsConfirmingArrival(false)
    }
  }

  const handleChegada = async () => {
    if (!clientCoords) {
      Alert.alert(
        'Localização do cliente indisponível',
        'Não foi possível obter o ponto do cliente. Contacta o apoio antes de confirmar a chegada.'
      )
      return
    }

    setIsConfirmingArrival(true)
    try {
      const servicosAtivos = await Location.hasServicesEnabledAsync()
      if (!servicosAtivos) {
        Alert.alert('GPS desligado', 'Ativa os serviços de localização para confirmar a chegada ao cliente.')
        return
      }

      const { status } = await Location.getForegroundPermissionsAsync()
      if (status !== 'granted') {
        const pedido = await Location.requestForegroundPermissionsAsync()
        if (pedido.status !== 'granted') {
          Alert.alert(
            'Permissão necessária',
            'Sem acesso à localização não é possível confirmar que estás no local do cliente.'
          )
          return
        }
      }

      const atual = await getCurrentPositionComTimeout()
      if (!atual) {
        Alert.alert(
          'Sem sinal GPS',
          'Não foi possível obter a tua posição agora. Tenta novamente ao ar livre.'
        )
        return
      }

      const point = { lat: atual.coords.latitude, lng: atual.coords.longitude }
      setProviderCoords(point)

      const distancia = distanceMeters(point, clientCoords)
      const dentroDoRaio = canConfirmArrival(point, clientCoords)
      const sandboxAtivo =
        (await loadSandboxSettings().catch(() => null))?.active ?? sandboxActive

      if (!canConfirmArrivalInSandbox(point, clientCoords, sandboxAtivo)) {
        Alert.alert(
          'Ainda não estás no local',
          `Estás a ${formatarDistancia(distancia)} do cliente. Aproxima-te para poderes confirmar a chegada (máximo ${MAX_ARRIVAL_DISTANCE_M} m).`
        )
        return
      }

      if (!dentroDoRaio) {
        Alert.alert(
          'Chegada fora do raio (sandbox)',
          `Estás a ${formatarDistancia(distancia)} do cliente. No modo sandbox a chegada é aceite a qualquer distância, mas para uma melhor avaliação do teu desempenho é importante que estejas próximo do cliente.`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Confirmar chegada',
              onPress: () => {
                void confirmarChegadaNoLocal()
              },
            },
          ]
        )
        return
      }

      await registarChegada()
    } catch (e) {
      console.warn('Erro ao confirmar chegada:', e)
      Alert.alert('Erro', 'Não foi possível confirmar a tua localização. Tenta novamente.')
    } finally {
      setIsConfirmingArrival(false)
    }
  }

  // 3. Iniciar trabalho
  const iniciarTrabalho = async () => {
    try {
      setIsStarting(true)
      const agora = new Date().toISOString()
      const { data: job, error } = await supabase
        .from('jobs')
        .update({ status: 'in_service', started_at: agora, updated_at: agora })
        .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
        .in('status', ['arrived', 'price_agreed'])
        .select('id, request_id, client_id')
        .maybeSingle()

      if (error) throw error
      if (!job) {
        const { data: atual } = await supabase
          .from('jobs')
          .select('status')
          .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
          .maybeSingle()
        if (atual?.status === 'in_service') {
          router.replace({ pathname: '/trabalho/em-curso', params: { jobId: params.jobId } })
        } else if (atual?.status === 'completed' || atual?.status === 'awaiting_confirmation') {
          Alert.alert('Serviço já concluído', 'Este serviço já foi concluído. Vê os teus ganhos na carteira.')
          router.replace('/carteira')
        } else {
          Alert.alert('Estado inválido', 'Este serviço já não pode ser iniciado.')
        }
        return
      }

      if (job.request_id) {
        await supabase
          .from('service_requests')
          .update({ status: 'in_progress', updated_at: agora })
          .eq('id', job.request_id)
      }

      router.replace({ pathname: '/trabalho/em-curso', params: { jobId: params.jobId } })
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível iniciar o trabalho.')
    } finally {
      setIsStarting(false)
    }
  }

  const handleIniciarTrabalho = () => {
    Alert.alert(
      'Iniciar trabalho',
      'Confirmas que estás com o cliente e vais começar o serviço agora?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sim, iniciar', onPress: iniciarTrabalho },
      ]
    )
  }

  const transporteActual = MEIOS_TRANSPORTE.find(t => t.id === transporte) || MEIOS_TRANSPORTE[0]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header com Status do Pagamento Garantido */}
      <View style={styles.header}>
        <View style={styles.garantiaBadge}>
          <Text style={styles.garantiaText}>🔒 PAGAMENTO RETIDO NA PLATAFORMA (ESCROW)</Text>
        </View>
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => router.push({ pathname: '/chat', params: { jobId: params.jobId } })}
          activeOpacity={0.8}
        >
          <Text style={styles.chatBtnText}>💬 Mensagens</Text>
        </TouchableOpacity>
        <Text style={styles.catEmoji}>{params.categoriaEmoji ?? '🔧'}</Text>
        <Text style={styles.headerTitle}>{jobData?.title || params.categoriaNome || 'Serviço Atribuído'}</Text>
        
        <View style={[styles.badge, fase === 'selecionar_transporte' ? styles.badgeReady : fase === 'en_route' ? styles.badgeRoute : styles.badgeArrived]}>
          <Text style={styles.badgeText}>
            {fase === 'selecionar_transporte' ? '🚗 Pronto para Partir' : fase === 'en_route' ? `${transporteActual.label.split(' ')[0]} A caminho` : '📍 Chegaste ao local'}
          </Text>
        </View>
      </View>

      {sandboxActive && (
        <View style={styles.sandboxBanner}>
          <Text style={styles.sandboxBannerText}>
            MODO SANDBOX — a chegada é aceite a qualquer distância. Para uma melhor avaliação do teu desempenho, mantém-te próximo do cliente.
          </Text>
        </View>
      )}

      <View style={styles.mapWrapper}>
        <MapaTracking provider={providerCoords} client={clientCoords} />
      </View>
      {locationError && <Text style={styles.locationError}>{locationError}</Text>}

      {/* FASE 1: Escolha do Transporte Antes de Partir */}
      {fase === 'selecionar_transporte' && (
        <View style={styles.transporteCard}>
          <Text style={styles.transporteLabel}>COMO TE VAIS DESLOCAR ATÉ AO CLIENTE?</Text>
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
            ℹ️ O cliente será informado do meio ({transporteActual.label}) e verá a tua aproximação no mapa.
          </Text>
        </View>
      )}

      {/* Card do Cliente com Dados Reais da Base de Dados */}
      <View style={styles.clienteCard}>
        {loading ? (
          <ActivityIndicator color="#F2C94C" />
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <Image
                source={{ uri: jobData?.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' }}
                style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#F2C94C', backgroundColor: '#334155' }}
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

            {clientCoords && (
              <Text style={styles.coordsText}>
                GPS: {clientCoords.lat.toFixed(5)}, {clientCoords.lng.toFixed(5)}
              </Text>
            )}
          </>
        )}
      </View>

      {/* FASE 1: Botão para Iniciar Deslocação */}
      {fase === 'selecionar_transporte' && (
        <TouchableOpacity style={styles.btnIniciar} onPress={handleIniciarDeslocacao} activeOpacity={0.85}>
          <Text style={styles.btnIniciarText}>
            🚗 INICIAR DESLOCAÇÃO (ESTOU A CAMINHO) →
          </Text>
        </TouchableOpacity>
      )}

      {/* FASE 2: A Caminho */}
      {fase === 'en_route' && (
        <>
          <TouchableOpacity style={styles.btnMapas} onPress={abrirMapas} activeOpacity={0.8}>
            <Text style={styles.btnMapasText}>🧭 Navegação passo-a-passo (opcional)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPrimary, isConfirmingArrival && { opacity: 0.6 }]}
            onPress={handleChegada}
            disabled={isConfirmingArrival}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPrimaryText}>
              {isConfirmingArrival ? 'A verificar localização...' : '📍 Já Cheguei ao Local do Cliente'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* FASE 3: Chegado ao Local */}
      {fase === 'arrived' && (
        <View style={styles.arrivedBox}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>📍</Text>
          <Text style={styles.arrivedTitle}>Chegaste ao Local!</Text>
          <Text style={styles.arrivedSub}>
            O cliente foi notificado de que já estás no ponto de encontro. Podes iniciar a execução do trabalho acordado.
          </Text>
          <TouchableOpacity 
            style={[styles.btnPrimary, { backgroundColor: '#2563EB', borderColor: '#60A5FA', marginTop: 16 }, isStarting && { opacity: 0.6 }]} 
            onPress={handleIniciarTrabalho} 
            disabled={isStarting}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPrimaryText}>
              {isStarting ? 'A iniciar...' : '🔧 Iniciar Trabalho →'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A' },
  scrollContent: { flexGrow: 1, padding: 20, paddingTop: 44 },
  sandboxBanner: { backgroundColor: 'rgba(242,201,76,0.18)', borderWidth: 1.5, borderColor: '#F2C94C', borderRadius: 8, padding: 10, marginBottom: 12 },
  sandboxBannerText: { color: '#F2C94C', fontWeight: '900', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  mapWrapper: { height: 180, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 12 },
  locationError: { color: '#FCA5A5', fontSize: 11, marginBottom: 8, textAlign: 'center' },
  header: { alignItems: 'center', marginBottom: 16 },
  garantiaBadge: { backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1, borderColor: '#4ADE80', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, marginBottom: 12 },
  garantiaText: { color: '#4ADE80', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  chatBtn: { backgroundColor: 'rgba(242,201,76,0.12)', borderWidth: 1, borderColor: '#F2C94C', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  chatBtnText: { color: '#F2C94C', fontSize: 11, fontWeight: '900' },
  catEmoji: { fontSize: 40, marginBottom: 4 },
  headerTitle: { fontSize: 19, fontWeight: '900', color: '#F5F0E8', marginBottom: 6, textAlign: 'center' },
  badge: { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  badgeReady: { backgroundColor: 'rgba(56,189,248,0.15)', borderColor: '#38BDF8' },
  badgeRoute: { backgroundColor: 'rgba(242,201,76,0.15)', borderColor: '#F2C94C' },
  badgeArrived: { backgroundColor: 'rgba(74,222,128,0.15)', borderColor: '#4ADE80' },
  badgeText: { fontWeight: '800', color: '#F5F0E8', fontSize: 12 },
  clienteCard: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16 },
  clienteLabel: { fontSize: 10, fontWeight: '700', color: '#F2C94C', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  clienteNome: { fontSize: 17, fontWeight: '900', color: '#F5F0E8' },
  clienteRef: { fontSize: 13, color: '#38BDF8', lineHeight: 18, fontWeight: '600', marginTop: 4 },
  coordsText: { fontSize: 11, color: '#94A3B8', marginTop: 6, fontFamily: 'monospace' },
  transporteCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: 'rgba(242,201,76,0.3)', marginBottom: 16 },
  transporteLabel: { fontSize: 10, fontWeight: '800', color: '#F2C94C', letterSpacing: 1, marginBottom: 8 },
  transporteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  transporteBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  transporteBtnAtivo: { backgroundColor: '#F2C94C', borderColor: '#F2C94C' },
  transporteBtnText: { color: '#F5F0E8', fontSize: 11, fontWeight: '700' },
  transporteBtnTextAtivo: { color: '#1A1A2E', fontWeight: '900' },
  transporteNota: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 15 },
  btnIniciar: { backgroundColor: '#4ADE80', borderRadius: 8, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  btnIniciarText: { color: '#0F2D1A', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnMapas: { backgroundColor: '#1E3A5F', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#60A5FA' },
  btnMapasText: { color: '#60A5FA', fontWeight: '800', fontSize: 14 },
  btnPrimary: { backgroundColor: '#166534', borderRadius: 8, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: '#4ADE80' },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  arrivedBox: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  arrivedTitle: { fontSize: 22, fontWeight: '900', color: '#4ADE80', marginBottom: 6 },
  arrivedSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 18 },
})
