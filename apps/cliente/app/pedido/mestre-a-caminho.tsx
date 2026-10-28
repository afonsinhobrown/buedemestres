import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, ActivityIndicator } from 'react-native'
import { Alert } from '../../lib/alertCompat'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import MapaTracking from '../../components/MapaTracking'
import { parseGeoPoint, distanceMeters, type GeoPoint } from '../../lib/geo'

import { API_BASE } from '@/lib/api'
import { PaySuiteModal } from '../../components/PaySuiteModal'

export default function MestreACaminhoScreen() {
  const params = useLocalSearchParams<{
    jobId: string
    mestreNome?: string
    mestreFoto?: string
    mestreNota?: string
    distanciaM?: string
    etaMinutos?: string
    categoriaEmoji?: string
  }>()

  const [jobStatus, setJobStatus] = useState<'a_preparar' | 'en_route' | 'arrived' | 'in_service' | 'awaiting_confirmation' | 'completed' | 'disputed'>('a_preparar')
  const [transporteUtilizado, setTransporteUtilizado] = useState<string>('carro_proprio')
  const [addendum, setAddendum] = useState<any>(null)
  const [addendumPagando, setAddendumPagando] = useState(false)
  const [paySuiteCheckoutUrl, setPaySuiteCheckoutUrl] = useState<string | null>(null)
  const [paySuiteModalVisible, setPaySuiteModalVisible] = useState(false)
  const [providerPoint, setProviderPoint] = useState<GeoPoint | null>(null)
  const [clientPoint, setClientPoint] = useState<GeoPoint | null>(null)
  const [empresaInfo, setEmpresaInfo] = useState<{ trade_name: string; legal_name: string } | null>(null)
  const [mestreAtribuido, setMestreAtribuido] = useState<{ full_name: string; avatar_url: string | null } | null>(null)
  const [qrStartReady, setQrStartReady] = useState(false)
  const [qrFinishReady, setQrFinishReady] = useState(false)

  const [mestreInfo, setMestreInfo] = useState({
    nome: params.mestreNome || 'Mestre',
    nota: params.mestreNota || '5.0',
    avatar: params.mestreFoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    categoria: 'Mecânico',
  })

  // Distância real entre a posição partilhada pelo mestre e o local do
  // cliente. Antes usava valores fixos (2.1 km / 8 min) que apareciam mesmo
  // quando ambos estavam no mesmo sítio.
  const distanciaMetros =
    providerPoint && clientPoint
      ? distanceMeters(providerPoint, clientPoint)
      : params.distanciaM
        ? Number(params.distanciaM)
        : null

  const distanciaLabel =
    distanciaMetros == null
      ? '—'
      : distanciaMetros < 1000
        ? `${Math.round(distanciaMetros)} m`
        : `${(distanciaMetros / 1000).toFixed(1)} km`

  const etaMinutos =
    distanciaMetros == null
      ? params.etaMinutos ?? null
      : Math.max(1, Math.round((distanciaMetros / 1000 / 20) * 60))

  const categoriaEmoji = params.categoriaEmoji ?? '🔧'

  const transporteDesc = transporteUtilizado === 'chapa' ? '🚐 Chapa' :
                         transporteUtilizado === 'moto' ? '🏍️ Moto/Txopela' :
                         transporteUtilizado === 'tpm' ? '🚌 TPM (Autocarro)' :
                         transporteUtilizado === 'amigo' ? '🤝 Boleia' :
                         transporteUtilizado === 'a_pe' ? '🚶 A pé' : '🚗 Carro Pessoal'

  useEffect(() => {
    if (!params.jobId) return

    let pollTimer: NodeJS.Timeout

    const verificarProgressoMestre = async () => {
      try {
        const { data: job } = await supabase
          .from('jobs')
          .select('id, request_id, provider_id, status, transport_mode, cancel_reason, arrived_at, provider_lat, provider_lng')
          .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
          .maybeSingle()

        if (job) {
          if (job.provider_lat != null && job.provider_lng != null) {
            setProviderPoint({ lat: Number(job.provider_lat), lng: Number(job.provider_lng) })
          }

          if (job.request_id) {
            const { data: request } = await supabase
              .from('service_requests')
              .select('location')
              .eq('id', job.request_id)
              .maybeSingle()
            const point = parseGeoPoint(request?.location)
            if (point) setClientPoint(point)
          }
          const { data: addenda } = await supabase
            .from('job_addenda')
            .select('*')
            .eq('job_id', job.id)
            .order('created_at', { ascending: false })
            .limit(1)
          setAddendum(addenda?.[0] || null)

          if (job.provider_id) {
            const { data: provider } = await supabase
              .from('provider_profiles')
              .select('business_name, profiles:profile_id(full_name, avatar_url)')
              .eq('profile_id', job.provider_id)
              .maybeSingle()
            if (provider) {
              setMestreAtribuido({
                full_name:
                  (provider.profiles as any)?.full_name || provider.business_name || 'Mestre',
                avatar_url: (provider.profiles as any)?.avatar_url || null,
              })
            }

            const { data: companyMaster } = await supabase
              .from('company_masters')
              .select('company:company_id(trade_name, legal_name)')
              .eq('provider_id', job.provider_id)
              .maybeSingle()
            setEmpresaInfo((companyMaster as any)?.company || null)
          }
          const modo = job.transport_mode || job.cancel_reason
          if (modo) {
            setTransporteUtilizado(modo)
          }

          if (job.status === 'en_route') {
            setJobStatus('en_route')
          } else if (job.status === 'arrived') {
            setJobStatus('arrived')
          } else if (job.status === 'in_service') {
            setJobStatus('in_service')
          } else if (job.status === 'awaiting_confirmation') {
            setJobStatus('awaiting_confirmation')
          } else if (job.status === 'completed') {
            setJobStatus('completed')
          } else if (job.status === 'disputed') {
            setJobStatus('disputed')
          } else {
            setJobStatus('a_preparar')
          }
        }

        try {
          const qrRes = await fetch(`${API_BASE}/api/jobs/qr/status?jobId=${encodeURIComponent(params.jobId)}`)
          const qrData = await qrRes.json().catch(() => ({}))
          if (qrData?.ok) {
            setQrStartReady(Boolean(qrData.startReady))
            setQrFinishReady(Boolean(qrData.finishReady))
          }
        } catch {
          // QR é opcional em caso de falha de rede
        }
      } catch (err) {
        console.warn('Erro ao verificar progresso do mestre:', err)
      }
    }

    verificarProgressoMestre()
    pollTimer = setInterval(verificarProgressoMestre, 2000)

    const channel = supabase
      .channel(`client_track_${params.jobId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => verificarProgressoMestre()
      )
      .subscribe()

    return () => {
      clearInterval(pollTimer)
      supabase.removeChannel(channel)
    }
  }, [params.jobId])

  const pagarAditamento = async (method: 'mpesa' | 'emola' | 'card') => {
    if (!addendum?.id) return
    try {
      setAddendumPagando(true)
      const res = await fetch(`${API_BASE}/api/payments/addendum/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addendumId: addendum.id, method })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Não foi possível iniciar o pagamento do aditamento.')
      }
      if (data.checkoutUrl) {
        setPaySuiteCheckoutUrl(data.checkoutUrl)
        setPaySuiteModalVisible(true)
      }
      let tries = 0
      const timer = setInterval(async () => {
        tries += 1
        try {
          const statusRes = await fetch(
            `${API_BASE}/api/payments/addendum/status?addendumId=${encodeURIComponent(addendum.id)}`
          )
          const statusData = await statusRes.json().catch(() => ({}))
          if (statusData?.paid) {
            clearInterval(timer)
            setPaySuiteModalVisible(false)
            setAddendum((prev: any) => ({ ...prev, status: 'held' }))
            Alert.alert('Aditamento pago', 'O valor adicional ficou retido em segurança.')
          } else if (statusData?.failed) {
            clearInterval(timer)
            setPaySuiteModalVisible(false)
            setAddendum((prev: any) => ({ ...prev, status: 'failed' }))
            Alert.alert('Pagamento não concluído', 'O pagamento do aditamento foi cancelado ou recusado.')
          }
        } catch {
          // continua a tentar
        }
        if (tries > 120) clearInterval(timer)
      }, 3000)
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao pagar o aditamento.')
    } finally {
      setAddendumPagando(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Mapa de Acompanhamento */}
      <View style={styles.mapWrapper}>
        <MapaTracking provider={providerPoint} client={clientPoint} />
        <View style={styles.mapOverlay}>
          <Text style={styles.mapOverlayText}>
            {jobStatus === 'a_preparar' ? 'Pagamento Retido · Mestre a preparar saída' :
             jobStatus === 'en_route' ? `Mestre a caminho (${transporteDesc})` :
             jobStatus === 'arrived' ? 'Mestre chegou ao ponto de encontro!' :
             jobStatus === 'in_service' ? 'Serviço em execução' :
             jobStatus === 'awaiting_confirmation' ? 'Mestre terminou — confirma o serviço' :
             jobStatus === 'disputed' ? 'Disputa em análise pela equipa de apoio' :
             'Serviço concluído'}
          </Text>
        </View>
      </View>

      {/* Painel Inferior */}
      <View style={styles.painel}>
        <View style={styles.dragHandle} />

        {/* Notificação de Estado */}
        {jobStatus === 'a_preparar' && (
          <View style={styles.prepararBox}>
            <Text style={styles.prepararBoxTitulo}>🔒 PAGAMENTO CONFIRMADO (ESCROW)</Text>
            <Text style={styles.prepararBoxTexto}>
              O mestre recebeu a confirmação do pagamento e está a preparar os materiais para iniciar a deslocação.
            </Text>
          </View>
        )}

        {jobStatus === 'en_route' && (
          <View style={styles.aCaminhoBox}>
            <Text style={styles.aCaminhoBoxTitulo}>🚗 MESTRE EM DESLOCAÇÃO</Text>
            <Text style={styles.aCaminhoBoxTexto}>
              O profissional está a deslocar-se de {transporteDesc}. Acompanhe a aproximação no mapa.
            </Text>
          </View>
        )}

        {jobStatus === 'arrived' && (
          <View style={styles.chegouBox}>
            <Text style={styles.chegouBoxTitulo}>📍 O MESTRE CHEGOU AO LOCAL!</Text>
            <Text style={styles.chegouBoxTexto}>
              O profissional está no ponto de encontro consigo para iniciar a execução do serviço acordado.
            </Text>
          </View>
        )}

        {jobStatus === 'in_service' && (
          <View style={styles.prepararBox}>
            <Text style={styles.prepararBoxTitulo}>🛠️ SERVIÇO EM EXECUÇÃO</Text>
            <Text style={styles.prepararBoxTexto}>
              O mestre está a realizar o trabalho. O pagamento continua retido até confirmares a conclusão.
            </Text>
          </View>
        )}

        {jobStatus === 'awaiting_confirmation' && (
          <View style={styles.chegouBox}>
            <Text style={styles.chegouBoxTitulo}>✅ O MESTRE TERMINOU O SERVIÇO</Text>
            <Text style={styles.chegouBoxTexto}>
              Verifica o trabalho realizado. Se estiver tudo bem, confirma para libertar o pagamento ao mestre.
            </Text>
          </View>
        )}

        {jobStatus === 'completed' && (
          <View style={styles.chegouBox}>
            <Text style={styles.chegouBoxTitulo}>🏆 SERVIÇO CONCLUÍDO</Text>
            <Text style={styles.chegouBoxTexto}>
              Confirmaste a conclusão e o pagamento foi libertado ao mestre. Podes avaliar o trabalho.
            </Text>
          </View>
        )}

        {jobStatus === 'disputed' && (
          <View style={styles.prepararBox}>
            <Text style={styles.prepararBoxTitulo}>🛡️ DISPUTA EM ANÁLISE</Text>
            <Text style={styles.prepararBoxTexto}>
              O pagamento continua retido até a equipa de apoio resolver a situação. Acompanha pelo suporte.
            </Text>
          </View>
        )}

        {addendum && (
          <View style={styles.addendumBox}>
            <Text style={styles.addendumTitulo}>➕ ADITAMENTO DE ORÇAMENTO</Text>
            <Text style={styles.addendumValor}>
              MT {Number(addendum.amount).toLocaleString('pt-MZ')}
            </Text>
            {addendum.description ? (
              <Text style={styles.addendumDesc}>{addendum.description}</Text>
            ) : null}

            {addendum.status === 'held' || addendum.status === 'released' ? (
              <Text style={styles.addendumOk}>✓ Pago e retido em segurança.</Text>
            ) : addendum.status === 'failed' ? (
              <Text style={styles.addendumFalhou}>O pagamento não foi concluído. Tenta novamente:</Text>
            ) : (
              <Text style={styles.addendumPendente}>Paga o valor adicional para continuar:</Text>
            )}

            {(addendum.status === 'pending_payment' || addendum.status === 'failed') && (
              <View style={styles.addendumMethods}>
                <TouchableOpacity
                  style={styles.addendumMethodBtn}
                  onPress={() => pagarAditamento('mpesa')}
                  disabled={addendumPagando}
                >
                  <Text style={styles.addendumMethodText}>M-Pesa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addendumMethodBtn}
                  onPress={() => pagarAditamento('emola')}
                  disabled={addendumPagando}
                >
                  <Text style={styles.addendumMethodText}>e-Mola</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addendumMethodBtn}
                  onPress={() => pagarAditamento('card')}
                  disabled={addendumPagando}
                >
                  <Text style={styles.addendumMethodText}>Cartão</Text>
                </TouchableOpacity>
              </View>
            )}
            {addendumPagando && <ActivityIndicator color="#2444C8" />}
          </View>
        )}

        {empresaInfo && (
          <View style={styles.empresaBox}>
            <Text style={styles.empresaLabel}>EMPRESA PRESTADORA</Text>
            <Text style={styles.empresaNome}>{empresaInfo.trade_name || empresaInfo.legal_name}</Text>
            <Text style={styles.empresaMestre}>
              Mestre atribuído: {mestreAtribuido?.full_name || mestreInfo.nome}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.reportarBtn}
          onPress={() => router.push({ pathname: '/reportar-mestre', params: { jobId: params.jobId } })}
          activeOpacity={0.8}
        >
          <Text style={styles.reportarText}>⚠ Mestre diferente do atribuído? Reportar</Text>
        </TouchableOpacity>

        {/* Informações Reais do Mestre */}
        <View style={styles.mestreRow}>
          <Image
            source={{ uri: mestreInfo.avatar }}
            style={styles.mestreAvatarImg}
          />
          <View style={styles.mestreInfo}>
            <Text style={styles.mestreNome}>{mestreInfo.nome}</Text>
            <Text style={styles.mestreNota}>⭐ {mestreInfo.nota} · Mestre Verificado ✓</Text>
          </View>
        </View>

        {/* ETA */}
        <View style={styles.etaCard}>
          <View style={styles.etaItem}>
            <Text style={styles.etaValor}>
              {jobStatus === 'arrived' ? '0 min' : etaMinutos != null ? `${etaMinutos} min` : '—'}
            </Text>
            <Text style={styles.etaLabel}>Previsão</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValor}>
              {jobStatus === 'arrived' ? 'No local' : distanciaLabel}
            </Text>
            <Text style={styles.etaLabel}>Distância</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValor}>{transporteDesc.split(' ')[0]}</Text>
            <Text style={styles.etaLabel}>Transporte</Text>
          </View>
        </View>

        {qrStartReady && (
          <TouchableOpacity
            style={[styles.btnAcompanharServico, { backgroundColor: '#1D4ED8', borderColor: '#60A5FA' }]}
            onPress={() => router.push({ pathname: '/scan-qr', params: { jobId: params.jobId, phase: 'start' } })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAcompanharServicoText}>📷 Ler QR de Início</Text>
          </TouchableOpacity>
        )}

        {qrFinishReady && (
          <TouchableOpacity
            style={[styles.btnAcompanharServico, { backgroundColor: '#B45309', borderColor: '#F59E0B' }]}
            onPress={() => router.push({ pathname: '/scan-qr', params: { jobId: params.jobId, phase: 'finish' } })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAcompanharServicoText}>📷 Ler QR de Conclusão</Text>
          </TouchableOpacity>
        )}

        {jobStatus === 'arrived' && (
          <TouchableOpacity 
            style={styles.btnAcompanharServico} 
            onPress={() => router.push({ pathname: '/pedido/confirmar', params: { jobId: params.jobId } })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAcompanharServicoText}>🔧 Acompanhar Execução do Serviço →</Text>
          </TouchableOpacity>
        )}

        {jobStatus === 'awaiting_confirmation' && (
          <TouchableOpacity 
            style={styles.btnAcompanharServico} 
            onPress={() => router.push({ pathname: '/pedido/confirmar', params: { jobId: params.jobId } })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAcompanharServicoText}>✓ Verificar e Confirmar Conclusão →</Text>
          </TouchableOpacity>
        )}

        {jobStatus === 'completed' && (
          <TouchableOpacity 
            style={styles.btnAcompanharServico} 
            onPress={() => router.push({ pathname: '/avaliar', params: { jobId: params.jobId } })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAcompanharServicoText}>⭐ Avaliar o Mestre →</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.btnChat}
          onPress={() => router.push({ pathname: '/chat', params: { jobId: params.jobId } })}
          activeOpacity={0.8}
        >
          <Text style={styles.btnChatText}>💬 Falar com o Mestre</Text>
        </TouchableOpacity>

        <Text style={styles.aviso}>
          🔒 Segurança Bué de Mestres: Sem dinheiro em mão. O pagamento foi retido na plataforma e só é libertado após confirmar a conclusão.
        </Text>
      </View>

      <PaySuiteModal
        visible={paySuiteModalVisible}
        checkoutUrl={paySuiteCheckoutUrl}
        onClose={() => setPaySuiteModalVisible(false)}
        title="Pagamento de Aditamento - PaySuite"
      />
    </View>
  )
}

const TINTA = '#1A1A2E'
const PAPEL = '#F5F0E8'
const AMARELO = '#F2C94C'
const ZINCO = '#6B7280'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8E4D8' },
  mapWrapper: { flex: 1, position: 'relative', minHeight: 220 },
  mapOverlay: { position: 'absolute', top: 12, left: 12, right: 12, backgroundColor: 'rgba(245,240,232,0.92)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(26,26,46,0.15)' },
  mapOverlayText: { color: TINTA, fontWeight: '900', fontSize: 13, textAlign: 'center' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D4CFB8', position: 'relative' },
  mapPlaceholderText: { fontSize: 52, marginBottom: 6 },
  mapPlaceholderSub: { fontSize: 16, color: TINTA, fontWeight: '800' },
  mapPlaceholderHint: { fontSize: 12, color: ZINCO, marginTop: 4 },
  mestrePlacaMap: {
    position: 'absolute', top: '35%', left: '50%',
    width: 48, height: 48, borderRadius: 8, backgroundColor: TINTA,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: AMARELO,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  mestrePlacaMapEmoji: { fontSize: 22 },
  empresaBox: { backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#3B82F6', borderRadius: 8, padding: 12, marginBottom: 10 },
  empresaLabel: { color: '#1D4ED8', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  empresaNome: { color: '#12163A', fontSize: 16, fontWeight: '900', marginTop: 2 },
  empresaMestre: { color: '#1E40AF', fontSize: 12, marginTop: 2 },
  reportarBtn: { paddingVertical: 8, alignItems: 'center', marginBottom: 10 },
  reportarText: { color: '#B91C1C', fontSize: 11, fontWeight: '800' },
  painel: { backgroundColor: PAPEL, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, borderTopWidth: 2, borderColor: TINTA },
  dragHandle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  prepararBox: { backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#3B82F6', borderRadius: 8, padding: 12, marginBottom: 14 },
  prepararBoxTitulo: { color: '#1D4ED8', fontWeight: '900', fontSize: 11, letterSpacing: 0.5, marginBottom: 2 },
  prepararBoxTexto: { color: '#1E40AF', fontSize: 12, lineHeight: 16 },
  aCaminhoBox: { backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: '#F59E0B', borderRadius: 8, padding: 12, marginBottom: 14 },
  aCaminhoBoxTitulo: { color: '#B45309', fontWeight: '900', fontSize: 11, letterSpacing: 0.5, marginBottom: 2 },
  aCaminhoBoxTexto: { color: '#78350F', fontSize: 12, lineHeight: 16 },
  chegouBox: { backgroundColor: '#ECFDF5', borderWidth: 1.5, borderColor: '#10B981', borderRadius: 8, padding: 12, marginBottom: 14 },
  chegouBoxTitulo: { color: '#047857', fontWeight: '900', fontSize: 12, letterSpacing: 0.5, marginBottom: 2 },
  chegouBoxTexto: { color: '#065F46', fontSize: 12, lineHeight: 16 },
  addendumBox: { backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: '#D97706', borderRadius: 8, padding: 12, marginBottom: 14 },
  addendumTitulo: { color: '#92400E', fontWeight: '900', fontSize: 10, letterSpacing: 0.8, marginBottom: 4 },
  addendumValor: { color: '#78350F', fontWeight: '900', fontSize: 22, marginBottom: 4 },
  addendumDesc: { color: '#92400E', fontSize: 12, lineHeight: 16, marginBottom: 8 },
  addendumPendente: { color: '#78350F', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  addendumOk: { color: '#166534', fontSize: 12, fontWeight: '900' },
  addendumFalhou: { color: '#B91C1C', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  addendumMethods: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addendumMethodBtn: { flex: 1, backgroundColor: '#2444C8', borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  addendumMethodText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  mestreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  mestreAvatarImg: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: AMARELO, marginRight: 12, backgroundColor: '#334155' },
  mestreInfo: { flex: 1 },
  mestreNome: { fontSize: 18, fontWeight: '900', color: TINTA, marginBottom: 2 },
  mestreNota: { fontSize: 13, color: ZINCO, fontWeight: '600' },
  etaCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  etaItem: { flex: 1, alignItems: 'center' },
  etaValor: { fontSize: 15, fontWeight: '900', color: TINTA, marginBottom: 2 },
  etaLabel: { fontSize: 10, color: ZINCO, textTransform: 'uppercase', letterSpacing: 0.5 },
  etaDivider: { width: 1, backgroundColor: '#E5E7EB' },
  btnAcompanharServico: { backgroundColor: '#166534', borderRadius: 8, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: '#4ADE80', marginBottom: 12 },
  btnAcompanharServicoText: { color: '#fff', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnChat: { backgroundColor: '#FFFFFF', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#12163A', marginBottom: 12 },
  btnChatText: { color: '#12163A', fontWeight: '900', fontSize: 13 },
  aviso: { fontSize: 11, color: ZINCO, textAlign: 'center', lineHeight: 16 },
})
