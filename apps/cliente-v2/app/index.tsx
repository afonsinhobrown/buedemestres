import { colors, radius, shadows, firstName, formatMoney } from '@/lib/theme'
import { Avatar, BrandMark, Button, IconButton, SectionHeader } from '@/components/v2'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Dimensions, Image, Modal } from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/useAuthStore'
import { supabase } from '@/lib/supabase'
import { loadSandboxSettings } from '@/lib/sandbox'
import { Alert } from '@/lib/alertCompat'

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
  const signOut = useAuthStore(s => s.signOut)

  const handleSignOut = () => {
    Alert.alert('Terminar sessão', 'Queres sair da tua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
    ])
  }

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

        // Um cliente pode ter mais do que um pedido activo. Dar prioridade ao
        // que precisa de acção (orçamento) evita mostrar "A procurar mestre"
        // por causa de outro pedido aberto mais recente.
        const prioridade: Record<string, number> = { price_proposed: 0, accepted: 1, in_progress: 2, open: 3 }
        const latest = [...(reqs as any[])].sort(
          (a, b) => (prioridade[a.status] ?? 9) - (prioridade[b.status] ?? 9)
        )[0]

        const { data: job } = await supabase
          .from('jobs')
          .select('id, status, provider_id')
          .eq('request_id', latest.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        let mestreNome = 'Mestre Profissional'
        const providerIdDoPedido = latest.target_provider_id || job?.provider_id
        if (providerIdDoPedido) {
          const { data: prov } = await supabase
            .from('provider_profiles')
            .select('business_name, profiles:profile_id(full_name)')
            .eq('profile_id', providerIdDoPedido)
            .maybeSingle()

          if (prov) {
            mestreNome = prov.business_name || (prov.profiles as any)?.full_name || mestreNome
          }
        }

        let valorProposta = latest.budget_max
        if (job?.status === 'price_proposed' || latest.status === 'price_proposed') {
          const { data: prop } = await supabase
            .from('job_price_proposals')
            .select('amount')
            .eq('job_id', job?.id || latest.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (prop?.amount) valorProposta = prop.amount
        }

        // O job avança mais depressa do que o pedido (ex.: mestre a caminho).
        // Se o job estiver num estado posterior, é ele que define o destino.
        const estadosDoJob = [
          'accepted', 'price_proposed', 'puxado', 'price_agreed',
          'en_route', 'arrived', 'in_service', 'in_progress', 'awaiting_confirmation'
        ]
        const estadoEfetivo = job && estadosDoJob.includes(job.status) ? job.status : latest.status

        const orderObj = { ...latest, status: estadoEfetivo, jobId: job?.id || latest.id, mestreNome, valorProposta }

        // Dispara notificação popup instantânea caso tenha acabado de receber orçamento
        if (estadoEfetivo === 'price_proposed' && (!activeOrder || activeOrder.status !== 'price_proposed')) {
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
    if (activeOrder.status === 'price_proposed' || activeOrder.status === 'accepted' || activeOrder.status === 'puxado') {
      router.push({
        pathname: '/pedido/proposta-preco',
        params: {
          jobId: activeOrder.jobId,
          mestreNome: activeOrder.mestreNome,
          categoriaEmoji: '🔧'
        }
      })
    } else if (activeOrder.status === 'open') {
      router.push({
        pathname: '/pedido/a-procurar',
        params: {
          requestId: activeOrder.id,
          categoriaId: (activeOrder.category_id || 2).toString(),
          categoriaNome: activeOrder.title || 'Mestre',
          descricao: activeOrder.description || '',
          referencia: activeOrder.location_note || ''
        }
      })
    } else {
      router.push({
        pathname: '/pedido/mestre-a-caminho',
        params: { jobId: activeOrder.jobId }
      })
    }
  }
  const displayName = firstName(profile?.full_name) || 'Cliente'
  const quickIcons: Record<string, string> = {
    eletricista: '⚡',
    canalizador: '🚰',
    mecanico: '🔧',
    pedreiro: '🧱',
  }

  const activeLabel =
    activeOrder?.status === 'price_proposed'
      ? 'Orçamento recebido'
      : activeOrder?.status === 'accepted'
        ? 'Mestre a analisar'
        : 'Pedido em andamento'

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <BrandMark size={38} />
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName}>Bué de Mestres</Text>
              <Text style={styles.brandTag}>O serviço certo, perto de ti</Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <IconButton
              icon="🔔"
              label="Notificações"
              badge={unreadCount}
              onPress={() => router.push('/notificacoes')}
            />
            <TouchableOpacity
              onPress={() => router.push('/perfil')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Abrir conta"
            >
              <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={42} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.greeting}>Olá, {displayName} 👋</Text>
          <Text style={styles.heroTitle}>O que precisas de resolver hoje?</Text>
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push('/pesquisar')}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Pesquisar um serviço"
          >
            <Text style={styles.searchIcon}>⌕</Text>
            <Text style={styles.searchText}>Pesquisar um serviço...</Text>
            <View style={styles.searchBtn}>
              <Text style={styles.searchBtnText}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {sandbox?.active && (
          <View style={styles.sandbox}>
            <Text style={styles.sandboxText}>
              🧪 Sandbox · serviços entre {formatMoney(sandbox.min)} e {formatMoney(sandbox.max)}
            </Text>
          </View>
        )}

        {activeOrder && (
          <View style={styles.activeCard}>
            <View style={styles.activeTop}>
              <View style={styles.activePill}>
                <View
                  style={[
                    styles.pulse,
                    activeOrder.status === 'price_proposed' && {
                      backgroundColor: colors.yellow,
                    },
                  ]}
                />
                <Text style={styles.activePillText}>{activeLabel}</Text>
              </View>
              <Text style={styles.activeTime}>Agora</Text>
            </View>

            <Text style={styles.activeTitle}>
              {!activeOrder.title || activeOrder.title.includes('undefined')
                ? 'Pedido urgente'
                : activeOrder.title}
            </Text>

            {activeOrder.status === 'price_proposed' ? (
              <View style={styles.priceBox}>
                <Text style={styles.priceLabel}>ORÇAMENTO RECEBIDO</Text>
                <Text style={styles.priceValue}>
                  {formatMoney(activeOrder.valorProposta || activeOrder.budget_max || 0)}
                </Text>
                <Text style={styles.priceNote}>
                  Mestre {activeOrder.mestreNome}. Analisa e decide na app.
                </Text>
              </View>
            ) : (
              <Text style={styles.activeDesc}>
                {activeOrder.status === 'accepted'
                  ? `Mestre ${activeOrder.mestreNome} aceitou o pedido e está a analisar.`
                  : activeOrder.description || 'A procurar o mestre mais próximo...'}
              </Text>
            )}

            <View style={styles.activeActions}>
              <Button
                label={
                  activeOrder.status === 'price_proposed'
                    ? 'Ver orçamento'
                    : 'Acompanhar pedido'
                }
                onPress={abrirPedidoAtivo}
                style={{ flex: 1 }}
              />
              <Button
                label="Ajuda"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/suporte',
                    params: { jobId: activeOrder.id, assunto: activeOrder.title },
                  })
                }
                style={{ minWidth: 88 }}
              />
            </View>
          </View>
        )}

        <SectionHeader
          title="Serviços rápidos"
          actionLabel="Ver tudo"
          onAction={() => router.push('/categorias')}
        />
        <View style={styles.categoryGrid}>
          {placasPrincipais.map((placa) => (
            <TouchableOpacity
              key={placa.id}
              style={styles.categoryCard}
              onPress={() => router.push(`/pedido/novo?categoria=${placa.id}`)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Pedir ${placa.nome}`}
            >
              <View style={styles.categoryIcon}>
                <Text style={styles.categoryEmoji}>{quickIcons[placa.id] || '🛠️'}</Text>
              </View>
              <Text style={styles.categoryName}>{placa.nome}</Text>
              <Text style={styles.categoryArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.shortcutRow}>
          <TouchableOpacity
            style={styles.shortcut}
            onPress={() => router.push('/pedidos')}
            activeOpacity={0.85}
          >
            <Text style={styles.shortcutIcon}>📋</Text>
            <Text style={styles.shortcutLabel}>Pedidos</Text>
            {activeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shortcut}
            onPress={() => router.push('/notificacoes')}
            activeOpacity={0.85}
          >
            <Text style={styles.shortcutIcon}>🔔</Text>
            <Text style={styles.shortcutLabel}>Alertas</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shortcut}
            onPress={() => router.push('/suporte')}
            activeOpacity={0.85}
          >
            <Text style={styles.shortcutIcon}>🎧</Text>
            <Text style={styles.shortcutLabel}>Apoio</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.promo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.promoEyebrow}>CONFIANÇA</Text>
            <Text style={styles.promoTitle}>Mestres verificados</Text>
            <Text style={styles.promoText}>
              Identidade e qualidade verificadas antes de receberes propostas.
            </Text>
          </View>
          <Button
            label="Pedir agora"
            onPress={() => router.push('/categorias')}
            style={styles.promoBtn}
          />
        </View>

        <View style={styles.howCard}>
          <Text style={styles.howTitle}>Como funciona</Text>
          {[
            { n: '1', t: 'Descreve', d: 'Diz o que precisas e onde estás.' },
            { n: '2', t: 'Recebe propostas', d: 'Compara mestres e preços.' },
            { n: '3', t: 'Confirma e avalia', d: 'O valor fica retido até ao fim.' },
          ].map((step) => (
            <View key={step.n} style={styles.howRow}>
              <View style={styles.howNumber}>
                <Text style={styles.howNumberText}>{step.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.howStepTitle}>{step.t}</Text>
                <Text style={styles.howStepText}>{step.d}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={modalPropostaVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setModalPropostaVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Text style={{ fontSize: 26 }}>🔔</Text>
            </View>
            <Text style={styles.modalTitle}>Nova proposta de orçamento</Text>
            <Text style={styles.modalSub}>
              O mestre{' '}
              <Text style={{ fontWeight: '900' }}>
                {propostaModalData?.mestreNome || 'atribuído'}
              </Text>{' '}
              enviou um orçamento para o teu pedido.
            </Text>
            <View style={styles.modalPrice}>
              <Text style={styles.modalPriceLabel}>VALOR PROPOSTO</Text>
              <Text style={styles.modalPriceValue}>
                {formatMoney(
                  propostaModalData?.valorProposta || propostaModalData?.budget_max || 0
                )}
              </Text>
              <Text style={styles.modalPriceNote}>
                O valor só é pago depois da tua concordância.
              </Text>
            </View>
            <Button
              label="Ver orçamento e decidir"
              onPress={() => {
                setModalPropostaVisivel(false)
                abrirPedidoAtivo()
              }}
            />
            <TouchableOpacity
              onPress={() => setModalPropostaVisivel(false)}
              style={styles.modalLater}
              activeOpacity={0.7}
            >
              <Text style={styles.modalLaterText}>Decidir mais tarde</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 26 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  brandName: { fontSize: 18, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 },
  brandTag: { fontSize: 10, fontWeight: '600', color: colors.muted, marginTop: 2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hero: {
    padding: 20,
    marginBottom: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  greeting: { fontSize: 13, fontWeight: '700', color: colors.muted },
  heroTitle: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.7,
    color: colors.ink,
  },
  searchBar: {
    height: 54,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchIcon: { fontSize: 20, color: colors.muted },
  searchText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.muted },
  searchBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { fontSize: 17, fontWeight: '900', color: colors.navy },
  sandbox: {
    marginBottom: 14,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: '#FFF4CC',
    borderWidth: 1,
    borderColor: '#F2D36B',
  },
  sandboxText: { fontSize: 11, fontWeight: '800', color: '#6B5300' },
  activeCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.navy,
    ...shadows.card,
  },
  activeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },
  activePillText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  activeTime: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700' },
  activeTitle: {
    color: colors.white,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    marginBottom: 10,
  },
  activeDesc: { color: '#C8D3E6', fontSize: 12, lineHeight: 18 },
  priceBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  priceLabel: {
    color: '#9DB4D4',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  priceValue: { marginTop: 3, color: colors.yellow, fontSize: 24, fontWeight: '900' },
  priceNote: { marginTop: 3, color: '#C8D3E6', fontSize: 11, lineHeight: 16 },
  activeActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  categoryCard: {
    width: '48.5%',
    minHeight: 74,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  categoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: { fontSize: 19 },
  categoryName: { flex: 1, fontSize: 12, fontWeight: '900', color: colors.ink },
  categoryArrow: { fontSize: 15, color: colors.muted, fontWeight: '800' },
  shortcutRow: { flexDirection: 'row', gap: 9, marginBottom: 18 },
  shortcut: {
    flex: 1,
    minHeight: 76,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  shortcutIcon: { fontSize: 20 },
  shortcutLabel: { fontSize: 11, fontWeight: '800', color: colors.ink },
  badge: {
    position: 'absolute',
    top: 7,
    right: 7,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  promo: {
    marginBottom: 18,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promoEyebrow: {
    color: '#9DB4D4',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  promoTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  promoText: {
    color: '#C8D3E6',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  promoBtn: { minHeight: 40, paddingHorizontal: 12 },
  howCard: {
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  howTitle: { fontSize: 17, fontWeight: '900', color: colors.ink, marginBottom: 12 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  howNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumberText: { color: colors.blue, fontSize: 13, fontWeight: '900' },
  howStepTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  howStepText: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    padding: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '900',
    color: colors.ink,
  },
  modalSub: {
    marginTop: 8,
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  modalPrice: {
    marginBottom: 16,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  modalPriceLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalPriceValue: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  modalPriceNote: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10,
    textAlign: 'center',
  },
  modalLater: { alignItems: 'center', paddingVertical: 12 },
  modalLaterText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
})
