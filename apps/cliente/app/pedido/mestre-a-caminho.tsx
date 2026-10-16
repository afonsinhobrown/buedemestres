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
    transporte?: string
  }>()

  const [mestreInfo, setMestreInfo] = useState({
    nome: params.mestreNome || 'Provedor 1',
    nota: params.mestreNota || '5.0',
    avatar: params.mestreFoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    categoria: 'Mecânico',
  })
  const [temProposta, setTemProposta] = useState(false)
  const [propostaValor, setPropostaValor] = useState<number | null>(null)

  const etaMinutos = params.etaMinutos ?? '8'
  const distanciaM = params.distanciaM ?? '2100'
  const categoriaEmoji = params.categoriaEmoji ?? '🔧'
  const transporteDesc = params.transporte === 'chapa' ? '🚐 Chapa' :
                         params.transporte === 'moto' ? '🏍️ Moto/Txopela' :
                         params.transporte === 'tpm' ? '🚌 TPM' :
                         params.transporte === 'amigo' ? '🤝 Boleia' :
                         params.transporte === 'a_pe' ? '🚶 A pé' : '🚗 Carro Próprio'

  // Carregar dados reais do mestre e escutar propostas de preço
  useEffect(() => {
    if (!params.jobId) return

    let pollTimer: NodeJS.Timeout

    const verificarPropostaEMestre = async () => {
      try {
        // 1. Verificar se mestre propôs preço
        const { data: prop } = await supabase
          .from('job_price_proposals')
          .select('*')
          .or(`job_id.eq.${params.jobId}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (prop) {
          setTemProposta(true)
          setPropostaValor(prop.amount)
        }

        // 2. Verificar dados do mestre via service_requests / jobs
        const { data: req } = await supabase
          .from('service_requests')
          .select('*, provider_profiles:target_provider_id(business_name, rating_avg, profiles:profile_id(full_name, avatar_url))')
          .eq('id', params.jobId)
          .maybeSingle()

        if (req?.provider_profiles) {
          const prov = req.provider_profiles as any
          setMestreInfo({
            nome: prov.business_name || prov.profiles?.full_name || mestreInfo.nome,
            nota: prov.rating_avg ? Number(prov.rating_avg).toFixed(1) : mestreInfo.nota,
            avatar: prov.profiles?.avatar_url || mestreInfo.avatar,
            categoria: req.title || 'Mestre Pro'
          })
          if (req.status === 'price_proposed' || req.budget_max) {
            setTemProposta(true)
            if (req.budget_max) setPropostaValor(req.budget_max)
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar mestre/proposta:', err)
      }
    }

    verificarPropostaEMestre()
    pollTimer = setInterval(verificarPropostaEMestre, 2000)

    // Subscrição Realtime
    const channel = supabase
      .channel(`client_mestre_cam_${params.jobId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_price_proposals' },
        () => verificarPropostaEMestre()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `id=eq.${params.jobId}` },
        () => verificarPropostaEMestre()
      )
      .subscribe()

    return () => {
      clearInterval(pollTimer)
      supabase.removeChannel(channel)
    }
  }, [params.jobId])

  const abrirProposta = () => {
    router.push({
      pathname: '/pedido/proposta-preco',
      params: {
        jobId: params.jobId,
        mestreNome: mestreInfo.nome,
        categoriaEmoji
      }
    })
  }

  return (
    <View style={styles.container}>
      {/* Mapa de Acompanhamento */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderText}>🗺️</Text>
        <Text style={styles.mapPlaceholderSub}>Acompanhamento em Tempo Real</Text>
        <Text style={styles.mapPlaceholderHint}>A aproximação do mestre é monitorizada no sistema</Text>

        <View style={styles.mestrePlacaMap}>
          <Text style={styles.mestrePlacaMapEmoji}>{categoriaEmoji}</Text>
        </View>
      </View>

      {/* Painel Inferior */}
      <View style={styles.painel}>
        <View style={styles.dragHandle} />

        {/* Notificação de Proposta no Sistema */}
        {temProposta && (
          <TouchableOpacity style={styles.propostaAlerta} onPress={abrirProposta} activeOpacity={0.85}>
            <View style={{ flex: 1 }}>
              <Text style={styles.propostaAlertaTitulo}>💼 NOVA PROPOSTA DE ORÇAMENTO!</Text>
              <Text style={styles.propostaAlertaTexto}>
                O mestre propôs MT {propostaValor ? propostaValor.toLocaleString('pt-MZ') : '...'}. Decide no sistema: Concordo, Não concordo ou Está puxado.
              </Text>
            </View>
            <Text style={styles.propostaAlertaSeta}>Ver →</Text>
          </TouchableOpacity>
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
            <Text style={styles.etaValor}>{etaMinutos} min</Text>
            <Text style={styles.etaLabel}>Previsão</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValor}>{(parseInt(distanciaM) / 1000).toFixed(1)} km</Text>
            <Text style={styles.etaLabel}>Distância</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValor}>{transporteDesc}</Text>
            <Text style={styles.etaLabel}>Transporte</Text>
          </View>
        </View>

        {/* Botão de Negociação / Orçamento no Sistema (Sem telefone fora da plataforma) */}
        <TouchableOpacity style={styles.btnOrcamentoSistema} onPress={abrirProposta} activeOpacity={0.8}>
          <Text style={styles.btnOrcamentoSistemaText}>
            💼 {temProposta ? 'VER ORÇAMENTO & NEGOCIAR NO SISTEMA →' : 'ORÇAMENTO & PROPOSTA NO SISTEMA →'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.aviso}>
          🔒 Segurança Bué de Mestres: Todo o orçamento e negociação decorrem dentro da plataforma. Sem chamadas telefónicas externas.
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
  dragHandle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  propostaAlerta: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', padding: 14, borderRadius: 8, borderWidth: 1.5, borderColor: '#F59E0B', marginBottom: 16 },
  propostaAlertaTitulo: { color: '#B45309', fontWeight: '900', fontSize: 12, letterSpacing: 0.5, marginBottom: 2 },
  propostaAlertaTexto: { color: '#78350F', fontSize: 12, lineHeight: 16 },
  propostaAlertaSeta: { color: '#B45309', fontWeight: '900', fontSize: 16, marginLeft: 10 },
  mestreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  mestreAvatarImg: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: AMARELO, marginRight: 14, backgroundColor: '#334155' },
  mestreInfo: { flex: 1 },
  mestreNome: { fontSize: 18, fontWeight: '900', color: TINTA, marginBottom: 2 },
  mestreNota: { fontSize: 13, color: ZINCO, fontWeight: '600' },
  etaCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  etaItem: { flex: 1, alignItems: 'center' },
  etaValor: { fontSize: 16, fontWeight: '900', color: TINTA, marginBottom: 2 },
  etaLabel: { fontSize: 10, color: ZINCO, textTransform: 'uppercase', letterSpacing: 0.5 },
  etaDivider: { width: 1, backgroundColor: '#E5E7EB' },
  btnOrcamentoSistema: { backgroundColor: TINTA, borderRadius: 8, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: AMARELO, marginBottom: 12 },
  btnOrcamentoSistemaText: { color: AMARELO, fontWeight: '900', fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  aviso: { fontSize: 11, color: ZINCO, textAlign: 'center', lineHeight: 16 },
})
