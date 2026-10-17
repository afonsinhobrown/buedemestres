import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Dimensions, Image, Modal } from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/useAuthStore'
import { supabase } from '@/lib/supabase'
import { loadSandboxSettings } from '@/lib/sandbox'

const { width } = Dimensions.get('window')

const placasPrincipais = [
  { id: 'eletricista', nome: 'Eletricista', bg: '#2444C8', text: '#FFFFFF', border: '#12163A' },
  { id: 'canalizador', nome: 'Canalizador', bg: '#FFC61A', text: '#12163A', border: '#12163A' },
  { id: 'mecanico', nome: 'Mecânico', bg: '#BF3A21', text: '#FFFFFF', border: '#12163A' },
  { id: 'pedreiro', nome: 'Pedreiro', bg: '#FFFFFF', text: '#12163A', border: '#2444C8', innerBorder: true },
]

export default function HomeScreen() {
  const profile = useAuthStore(s => s.profile)
  const loadProfile = useAuthStore(s => s.loadProfile)

  const [activeOrder, setActiveOrder] = useState<any>(null)
  const [activeCount, setActiveCount] = useState<number>(0)
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [sandbox, setSandbox] = useState<{ active: boolean; min: number; max: number } | null>(null)
  const [modalPropostaVisivel, setModalPropostaVisivel] = useState(false)
  const [propostaModalData, setPropostaModalData] = useState<any>(null)

  const clientId = profile?.id || ''

  useEffect(() => {
    if (!profile) loadProfile()
  }, [profile])

  // Verificação e recuperação em tempo real de pedidos activos
  const verificarPedidosAtivos = async () => {
    try {
      const { data: reqs, error } = await supabase
        .from('service_requests')
        .select(`
          id,
          title,
          category_id,
          description,
          location_note,
          status,
          budget_max,
          target_provider_id,
          created_at
        `)
        .eq('client_id', clientId)
        .in('status', ['open', 'accepted', 'price_proposed', 'in_progress'])
        .order('created_at', { ascending: false })

      if (!error && reqs && reqs.length > 0) {
        setActiveCount(reqs.length)
        const latest = reqs[0]

        let mestreNome = 'Mestre Profissional'
        if (latest.target_provider_id) {
          const { data: prov } = await supabase
            .from('provider_profiles')
            .select('business_name, profiles:profile_id(full_name)')
            .eq('profile_id', latest.target_provider_id)
            .maybeSingle()

          if (prov) {
            mestreNome = prov.business_name || (prov.profiles as any)?.full_name || mestreNome
          }
        }

        let valorProposta = latest.budget_max
        if (latest.status === 'price_proposed') {
          const { data: prop } = await supabase
            .from('job_price_proposals')
            .select('*')
            .or(`job_id.eq.${latest.id}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (prop?.amount) valorProposta = prop.amount
        }

        const orderObj = { ...latest, mestreNome, valorProposta }

        // Dispara notificação popup instantânea caso tenha acabado de receber orçamento
        if (latest.status === 'price_proposed' && (!activeOrder || activeOrder.status !== 'price_proposed')) {
          setPropostaModalData(orderObj)
          setModalPropostaVisivel(true)
        }

        setActiveOrder(orderObj)
      } else {
        setActiveOrder(null)
        setActiveCount(0)
      }
    } catch (err) {
      console.warn('Erro ao verificar pedidos ativos na Home:', err)
    }
  }

  useEffect(() => {
    verificarPedidosAtivos()
    const pollInterval = setInterval(verificarPedidosAtivos, 2500)

    const channel = supabase
      .channel(`home_orders_${clientId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `client_id=eq.${clientId}` },
        () => verificarPedidosAtivos()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_price_proposals' },
        () => verificarPedidosAtivos()
      )
      .subscribe()

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [clientId, activeOrder?.status])

  useEffect(() => {
    let mounted = true
    loadSandboxSettings()
      .then((settings) => {
        if (mounted) setSandbox(settings)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!clientId) return
    let active = true
    const carregarNaoLidas = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', clientId)
        .is('read_at', null)
      if (active) setUnreadCount(count || 0)
    }
    carregarNaoLidas()
    const timer = setInterval(carregarNaoLidas, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [clientId])

  const abrirPedidoAtivo = () => {
    if (!activeOrder) return
    if (activeOrder.status === 'price_proposed' || activeOrder.status === 'accepted') {
      router.push({
        pathname: '/pedido/proposta-preco',
        params: {
          jobId: activeOrder.id,
          mestreNome: activeOrder.mestreNome,
          categoriaEmoji: '🔧'
        }
      })
    } else if (activeOrder.status === 'open') {
      router.push({
        pathname: '/pedido/a-procurar',
        params: {
          categoriaId: (activeOrder.category_id || 2).toString(),
          categoriaNome: activeOrder.title || 'Mestre',
          descricao: activeOrder.description || '',
          referencia: activeOrder.location_note || ''
        }
      })
    } else {
      router.push({
        pathname: '/pedido/mestre-a-caminho',
        params: { jobId: activeOrder.id }
      })
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF0F2" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* Header do Cliente */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Bom dia,</Text>
              <Text style={styles.userName}>{profile?.full_name || 'Cliente Registado'}</Text>
            </View>
            <View style={styles.avatarButton}>
              <Image 
                source={{ uri: profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' }}
                style={styles.avatarImage}
              />
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>✓</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.brandRow}>
            <Text style={styles.logo}>Bué de Mestres</Text>

            {/* Acesso Rápido a Pedidos e Suporte */}
            <View style={styles.quickNavRow}>
              <TouchableOpacity 
                style={styles.navChip} 
                onPress={() => router.push('/pedidos')}
                activeOpacity={0.8}
              >
                <Text style={styles.navChipText}>📋 Meus Pedidos</Text>
                {activeCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{activeCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.navChip, styles.navChipSupport]} 
                onPress={() => router.push('/notificacoes')}
                activeOpacity={0.8}
              >
                <Text style={styles.navChipText}>🔔 Alertas</Text>
                {unreadCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.navChip, styles.navChipSupport]} 
                onPress={() => router.push('/suporte')}
                activeOpacity={0.8}
              >
                <Text style={styles.navChipText}>🎧 Suporte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {sandbox?.active && (
          <View style={styles.sandboxBanner}>
            <Text style={styles.sandboxBannerText}>
              🧪 MODO SANDBOX ATIVO — os serviços custam entre MT {sandbox.min} e MT {sandbox.max}.
            </Text>
          </View>
        )}

        {/* 🚨 CARD DE RECUPERAÇÃO E ESTADO DO PEDIDO ACTIVO */}
        {activeOrder && (
          <View style={[
            styles.activeOrderCard,
            activeOrder.status === 'price_proposed' && styles.activeOrderHighlight
          ]}>
            <View style={styles.activeOrderHeader}>
              <View style={styles.activeOrderBadge}>
                <View style={[
                  styles.pulseDot, 
                  activeOrder.status === 'price_proposed' && { backgroundColor: '#EAB308' }
                ]} />
                <Text style={styles.activeOrderBadgeText}>
                  {activeOrder.status === 'price_proposed' 
                    ? '🔔 ORÇAMENTO RECEBIDO!' 
                    : activeOrder.status === 'accepted'
                    ? '🟡 MESTRE A ANALISAR'
                    : '🔵 PEDIDO EM ANDAMENTO'}
                </Text>
              </View>
              <Text style={styles.activeOrderTime}>Hoje</Text>
            </View>

            <Text style={styles.activeOrderTitle}>
              {(!activeOrder.title || activeOrder.title.includes('undefined'))
                ? 'Pedido urgente: Mecânico'
                : activeOrder.title}
            </Text>
            
            {activeOrder.status === 'price_proposed' ? (
              <View style={styles.proposalNoticeBox}>
                <Text style={styles.proposalNoticeTitle}>
                  💰 Valor Proposto: MT {activeOrder.valorProposta || activeOrder.budget_max || '...'}
                </Text>
                <Text style={styles.proposalNoticeSub}>
                  O mestre {activeOrder.mestreNome} definiu o valor. Analise o orçamento para concordar ou negociar.
                </Text>
              </View>
            ) : (
              <Text style={styles.activeOrderDesc}>
                {activeOrder.status === 'accepted'
                  ? `Mestre ${activeOrder.mestreNome} aceitou o pedido e está a analisar o problema no sistema.`
                  : activeOrder.description || 'A procurar mestre mais próximo...'}
              </Text>
            )}

            <View style={styles.activeOrderActions}>
              <TouchableOpacity 
                style={[
                  styles.btnResume, 
                  activeOrder.status === 'price_proposed' && styles.btnResumeGold
                ]} 
                onPress={abrirPedidoAtivo}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.btnResumeText,
                  activeOrder.status === 'price_proposed' && { color: '#12163A' }
                ]}>
                  {activeOrder.status === 'price_proposed' 
                    ? 'VER ORÇAMENTO & NEGOCIAR →' 
                    : 'ACOMPANHAR PEDIDO →'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.btnQuickHelp}
                onPress={() => router.push({ pathname: '/suporte', params: { jobId: activeOrder.id, assunto: activeOrder.title } })}
                activeOpacity={0.8}
              >
                <Text style={styles.btnQuickHelpText}>Ajuda</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={styles.searchBar} 
          onPress={() => router.push('/pesquisar')}
          activeOpacity={0.9}
        >
          <View style={styles.searchSquare} />
          <Text style={styles.searchText}>O que precisas de arranjar hoje?</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Serviços Rápidos</Text>
          <TouchableOpacity onPress={() => router.push('/categorias')}>
            <Text style={styles.seeAll}>Ver tudo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.placasGrid}>
          {placasPrincipais.map((placa, index) => {
            const rotation = index % 2 === 0 ? '-1deg' : '1deg'
            return (
              <TouchableOpacity 
                key={placa.id}
                style={[
                  styles.placaContainer, 
                  { backgroundColor: placa.bg, borderColor: placa.border, transform: [{ rotate: rotation }] }
                ]}
                onPress={() => router.push(`/pedido/novo?categoria=${placa.id}`)}
                activeOpacity={0.8}
              >
                {placa.innerBorder && <View style={[styles.innerMoldura, { borderColor: placa.border }]} />}
                <Text style={[styles.placaText, { color: placa.text }]}>
                  {placa.nome.toUpperCase()}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.promoCard}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>Mestres Verificados</Text>
            <Text style={styles.promoDesc}>Todos os profissionais passam por verificação de identidade e qualidade.</Text>
            <TouchableOpacity style={styles.promoBtn} onPress={() => router.push('/categorias')}>
              <Text style={styles.promoBtnText}>Pedir Agora</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* 🔔 MODAL INSTANTÂNEO DE ORÇAMENTO RECEBIDO */}
      <Modal
        visible={modalPropostaVisivel}
        transparent
        animationType="slide"
        onRequestClose={() => setModalPropostaVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>🔔</Text>
            <Text style={styles.modalTitle}>Nova Proposta de Orçamento!</Text>
            <Text style={styles.modalSub}>
              O mestre <Text style={{ fontWeight: '900' }}>{propostaModalData?.mestreNome || 'atribuído'}</Text> enviou o orçamento para o seu pedido:
            </Text>

            <View style={styles.modalPriceBox}>
              <Text style={styles.modalPriceLabel}>VALOR PROPOSTO</Text>
              <Text style={styles.modalPriceValue}>
                MT {propostaModalData?.valorProposta || propostaModalData?.budget_max || '0'}
              </Text>
              <Text style={styles.modalPriceNote}>
                🔒 O valor só é pago e retido após a sua concordância.
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.modalBtnDecidir}
              onPress={() => {
                setModalPropostaVisivel(false)
                abrirPedidoAtivo()
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnDecidirText}>VER ORÇAMENTO & DECIDIR →</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalBtnFechar}
              onPress={() => setModalPropostaVisivel(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalBtnFecharText}>Decidir mais tarde</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDF0F2',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  sandboxBanner: {
    backgroundColor: '#FEF9C3',
    borderWidth: 2,
    borderColor: '#CA8A04',
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },
  sandboxBannerText: { color: '#854D0E', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  greeting: {
    fontSize: 14,
    color: '#5B6472',
    fontWeight: '600',
  },
  userName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#12163A',
  },
  avatarButton: {
    position: 'relative',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#12163A',
    backgroundColor: '#FFC61A',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#22c55e',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  avatarBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  logo: {
    fontSize: 30,
    fontWeight: '900',
    color: '#12163A',
    letterSpacing: -1,
  },
  quickNavRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#12163A',
    shadowColor: '#12163A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  navChipSupport: {
    backgroundColor: '#F3F4F6',
    borderColor: '#9CA3AF',
  },
  navChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#12163A',
  },
  countBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  /* Active Order Recovery Card */
  activeOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#2444C8',
    shadowColor: '#12163A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  activeOrderHighlight: {
    borderColor: '#CA8A04',
    backgroundColor: '#FEFCE8',
    borderWidth: 2.5,
  },
  activeOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeOrderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  activeOrderBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#12163A',
  },
  activeOrderTime: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  activeOrderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#12163A',
    marginBottom: 4,
  },
  activeOrderDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 14,
  },
  proposalNoticeBox: {
    backgroundColor: '#FEF08A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FACC15',
    marginBottom: 14,
  },
  proposalNoticeTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#854D0E',
    marginBottom: 2,
  },
  proposalNoticeSub: {
    fontSize: 12,
    color: '#713F12',
    lineHeight: 16,
  },
  activeOrderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnResume: {
    flex: 1,
    backgroundColor: '#2444C8',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#12163A',
  },
  btnResumeGold: {
    backgroundColor: '#F2C94C',
  },
  btnResumeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  btnQuickHelp: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  btnQuickHelpText: {
    color: '#4B5563',
    fontWeight: '800',
    fontSize: 13,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 2,
    borderColor: '#12163A',
    marginBottom: 32,
    shadowColor: '#12163A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  searchSquare: {
    width: 12,
    height: 12,
    backgroundColor: '#2444C8',
    marginRight: 16,
  },
  searchText: {
    fontSize: 16,
    color: '#5B6472',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#12163A',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2444C8',
  },
  placasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  placaContainer: {
    width: (width - 48 - 16) / 2,
    height: 76,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 8,
  },
  innerMoldura: {
    ...StyleSheet.absoluteFillObject,
    margin: 4,
    borderWidth: 2,
    borderRadius: 2,
  },
  placaText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  promoCard: {
    backgroundColor: '#1A329A',
    borderRadius: 10,
    padding: 22,
    borderWidth: 2,
    borderColor: '#12163A',
  },
  promoContent: {
    alignItems: 'flex-start',
  },
  promoTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFC61A',
    marginBottom: 6,
  },
  promoDesc: {
    fontSize: 14,
    color: '#DCE3FA',
    marginBottom: 20,
    lineHeight: 20,
  },
  promoBtn: {
    backgroundColor: '#FFC61A',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#12163A',
  },
  promoBtnText: {
    color: '#12163A',
    fontWeight: '800',
    fontSize: 14,
  },

  /* Modal Instantâneo */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#12163A',
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#12163A',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  modalPriceBox: {
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA8A04',
    marginBottom: 20,
  },
  modalPriceLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#854D0E',
    letterSpacing: 1,
  },
  modalPriceValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#12163A',
    marginVertical: 4,
  },
  modalPriceNote: {
    fontSize: 11,
    color: '#713F12',
    textAlign: 'center',
    fontWeight: '600',
  },
  modalBtnDecidir: {
    backgroundColor: '#F2C94C',
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#12163A',
    marginBottom: 10,
  },
  modalBtnDecidirText: {
    color: '#12163A',
    fontWeight: '900',
    fontSize: 15,
  },
  modalBtnFechar: {
    paddingVertical: 8,
  },
  modalBtnFecharText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
})
