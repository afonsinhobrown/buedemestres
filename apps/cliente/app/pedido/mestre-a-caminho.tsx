import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

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

  const [jobStatus, setJobStatus] = useState<'a_preparar' | 'en_route' | 'arrived' | 'in_service'>('a_preparar')
  const [transporteUtilizado, setTransporteUtilizado] = useState<string>('carro_proprio')

  const [mestreInfo, setMestreInfo] = useState({
    nome: params.mestreNome || 'Provedor 1',
    nota: params.mestreNota || '5.0',
    avatar: params.mestreFoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    categoria: 'Mecânico',
  })

  const etaMinutos = params.etaMinutos ?? '8'
  const distanciaM = params.distanciaM ?? '2100'
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
          .select('status, cancel_reason, arrived_at')
          .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
          .maybeSingle()

        if (job) {
          if (job.cancel_reason) {
            setTransporteUtilizado(job.cancel_reason)
          }

          if (job.status === 'en_route') {
            setJobStatus('en_route')
          } else if (job.status === 'arrived') {
            setJobStatus('arrived')
          } else if (job.status === 'in_service' || job.status === 'completed') {
            setJobStatus('in_service')
          } else {
            setJobStatus('a_preparar')
          }
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

  return (
    <View style={styles.container}>
      {/* Mapa de Acompanhamento */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderText}>🗺️</Text>
        <Text style={styles.mapPlaceholderSub}>
          {jobStatus === 'a_preparar' ? 'Pagamento Retido · Mestre a preparar saída' :
           jobStatus === 'en_route' ? `Mestre a caminho (${transporteDesc})` :
           'Mestre chegou ao ponto de encontro!'}
        </Text>
        <Text style={styles.mapPlaceholderHint}>A aproximação do mestre é acompanhada em tempo real</Text>

        <View style={styles.mestrePlacaMap}>
          <Text style={styles.mestrePlacaMapEmoji}>{categoriaEmoji}</Text>
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
              {jobStatus === 'arrived' ? '0 min' : etaMinutos + ' min'}
            </Text>
            <Text style={styles.etaLabel}>Previsão</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValor}>
              {jobStatus === 'arrived' ? 'No local' : (parseInt(distanciaM) / 1000).toFixed(1) + ' km'}
            </Text>
            <Text style={styles.etaLabel}>Distância</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValor}>{transporteDesc.split(' ')[0]}</Text>
            <Text style={styles.etaLabel}>Transporte</Text>
          </View>
        </View>

        {jobStatus === 'arrived' && (
          <TouchableOpacity 
            style={styles.btnAcompanharServico} 
            onPress={() => router.push({ pathname: '/pedido/confirmar', params: { jobId: params.jobId } })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAcompanharServicoText}>🔧 Acompanhar Execução do Serviço →</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.aviso}>
          🔒 Segurança Bué de Mestres: Sem dinheiro em mão. O pagamento foi retido na plataforma e só é libertado após confirmar a conclusão.
        </Text>
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
  aviso: { fontSize: 11, color: ZINCO, textAlign: 'center', lineHeight: 16 },
})
