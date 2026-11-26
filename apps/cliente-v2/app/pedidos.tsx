import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/useAuthStore'
import { Alert } from '@/lib/alertCompat'
import { BrandMark } from '@/components/v2'
import { colors, radius, shadows } from '@/lib/theme'

type Pedido = {
  id: string
  title: string | null
  description: string | null
  location_note: string | null
  status: string
  budget_max: number | null
  target_provider_id: string | null
  created_at: string
  category_id: number | null
}

const TABS = [
  { id: 'ativos' as const, label: 'Em andamento' },
  { id: 'concluidos' as const, label: 'Histórico' },
  { id: 'todos' as const, label: 'Todos' },
]

function statusInfo(status: string) {
  switch (status) {
    case 'price_proposed':
      return { label: 'Orçamento recebido', bg: '#FFF4CC', color: '#6B5300' }
    case 'accepted':
      return { label: 'Mestre a analisar', bg: '#E9EEFF', color: '#2444C8' }
    case 'open':
      return { label: 'A procurar mestre', bg: '#E9EEFF', color: '#2444C8' }
    case 'en_route':
      return { label: 'Mestre a caminho', bg: colors.greenSoft, color: colors.green }
    case 'arrived':
      return { label: 'Mestre no local', bg: colors.greenSoft, color: colors.green }
    case 'in_progress':
    case 'in_service':
      return { label: 'Em execução', bg: '#E9EEFF', color: '#2444C8' }
    case 'completed':
      return { label: 'Concluído', bg: colors.greenSoft, color: colors.green }
    case 'cancelled':
      return { label: 'Cancelado', bg: colors.redSoft, color: colors.red }
    default:
      return { label: status, bg: colors.paper, color: colors.muted }
  }
}

function formatTitle(title: string | null) {
  if (!title || title.includes('undefined')) return 'Pedido de assistência'
  return title
}

export default function PedidosScreen() {
  const profile = useAuthStore((s) => s.profile)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('ativos')

  const clientId = profile?.id || ''

  const carregarPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select(
          'id, title, description, location_note, status, budget_max, target_provider_id, created_at, category_id'
        )
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (!error && data) setPedidos(data as Pedido[])
    } catch (err) {
      console.warn('Erro ao carregar histórico de pedidos:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    carregarPedidos()

    const channel = supabase
      .channel(`client_orders_v2_${clientId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `client_id=eq.${clientId}` },
        () => carregarPedidos()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clientId])

  const pedidosFiltrados = pedidos.filter((p) => {
    const isAtivo = [
      'open',
      'accepted',
      'price_proposed',
      'in_progress',
      'en_route',
      'arrived',
      'price_agreed',
      'in_service',
      'awaiting_confirmation',
    ].includes(p.status)
    if (tab === 'ativos') return isAtivo
    if (tab === 'concluidos') return p.status === 'completed' || p.status === 'cancelled'
    return true
  })

  const retomarPedido = async (p: Pedido) => {
    try {
      const { data: job } = await supabase
        .from('jobs')
        .select('id, status')
        .eq('request_id', p.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (job) {
        if (['accepted', 'price_proposed', 'puxado'].includes(job.status)) {
          router.push({
            pathname: '/pedido/proposta-preco',
            params: { jobId: job.id, categoriaEmoji: '🔧' },
          })
          return
        }
        if (
          ['price_agreed', 'en_route', 'arrived', 'in_service', 'in_progress', 'awaiting_confirmation'].includes(
            job.status
          )
        ) {
          router.push({ pathname: '/pedido/mestre-a-caminho', params: { jobId: job.id } })
          return
        }
      }
    } catch (err) {
      console.warn('Erro ao resolver o trabalho do pedido:', err)
    }

    if (['price_proposed', 'accepted', 'puxado'].includes(p.status)) {
      router.push({
        pathname: '/pedido/proposta-preco',
        params: { jobId: p.id, categoriaEmoji: '🔧' },
      })
    } else if (['en_route', 'arrived', 'in_progress'].includes(p.status)) {
      router.push({ pathname: '/pedido/mestre-a-caminho', params: { jobId: p.id } })
    } else if (p.status === 'open') {
      router.push({
        pathname: '/pedido/a-procurar',
        params: {
          requestId: p.id,
          categoriaId: (p.category_id || 2).toString(),
          categoriaNome: p.title || 'Mestre',
          descricao: p.description || '',
          referencia: p.location_note || '',
        },
      })
    }
  }

  const estornarPedidoPago = async (jobId: string, destino: 'wallet' | 'paysuite') => {
    const { data, error } = await supabase.rpc('cancel_job_by_client', {
      p_job: jobId,
      p_destination: destino,
    })
    if (error || (data && data.ok === false)) {
      Alert.alert('Erro', error?.message || data?.error || 'Não foi possível cancelar o pedido.')
      return
    }
    await carregarPedidos()
  }

  const cancelarPedido = async (p: Pedido) => {
    try {
      const { data: job } = await supabase
        .from('jobs')
        .select('id, status, job_payments(status)')
        .eq('request_id', p.id)
        .in('status', ['price_agreed', 'en_route', 'arrived'])
        .maybeSingle()

      const pagamento = job?.job_payments?.[0]
      if (job && pagamento && pagamento.status === 'held') {
        Alert.alert(
          'Cancelar pedido',
          'O teu pagamento está retido. Onde queres receber o estorno?',
          [
            { text: 'Voltar', style: 'cancel' },
            { text: 'Na minha carteira', onPress: () => estornarPedidoPago(job.id, 'wallet') },
            { text: 'M-Pesa / eMola', onPress: () => estornarPedidoPago(job.id, 'paysuite') },
          ]
        )
        return
      }
    } catch (err) {
      console.warn('Erro ao verificar pagamento do pedido:', err)
    }

    Alert.alert('Cancelar pedido', 'Queres mesmo cancelar este pedido?', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('service_requests')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', p.id)
            .in('status', ['open', 'in_negotiation', 'accepted'])
          if (error) {
            Alert.alert('Erro', error.message || 'Não foi possível cancelar o pedido.')
            return
          }
          await carregarPedidos()
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              carregarPedidos()
            }}
            tintColor={colors.blue}
          />
        }
      >
        <View style={styles.topbar}>
          <BrandMark size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Os meus pedidos</Text>
            <Text style={styles.sub}>Acompanha pedidos em curso e o histórico.</Text>
          </View>
          <TouchableOpacity
            style={styles.supportBtn}
            onPress={() => router.push('/suporte')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Abrir suporte"
          >
            <Text style={{ fontSize: 17 }}>🎧</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          {TABS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.tab, tab === item.id && styles.tabActive]}
              onPress={() => setTab(item.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.blue} />
          </View>
        ) : pedidosFiltrados.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={{ fontSize: 26 }}>📋</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {tab === 'concluidos' ? 'Ainda não há histórico' : 'Não tens pedidos em curso'}
            </Text>
            <Text style={styles.emptyText}>
              Quando pedires um serviço, o estado aparece aqui em tempo real.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/categorias')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Pedir um serviço</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {pedidosFiltrados.map((pedido) => {
              const status = statusInfo(pedido.status)
              const active = !['completed', 'cancelled'].includes(pedido.status)
              return (
                <View key={pedido.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                      <Text style={[styles.statusText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                    <Text style={styles.date}>
                      {new Date(pedido.created_at).toLocaleDateString('pt-MZ', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.cardTitle}>{formatTitle(pedido.title)}</Text>
                  {pedido.description ? (
                    <Text style={styles.cardText} numberOfLines={2}>
                      {pedido.description}
                    </Text>
                  ) : null}
                  <View style={styles.cardMeta}>
                    {pedido.location_note ? (
                      <Text style={styles.metaText}>📍 {pedido.location_note}</Text>
                    ) : null}
                    {pedido.budget_max ? (
                      <Text style={styles.metaPrice}>
                        MT {Number(pedido.budget_max).toLocaleString('pt-MZ')}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => retomarPedido(pedido)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryBtnText}>
                        {pedido.status === 'open' ? 'Acompanhar' : 'Ver detalhes'}
                      </Text>
                    </TouchableOpacity>
                    {active && (
                      <TouchableOpacity
                        style={styles.ghostBtn}
                        onPress={() => cancelarPedido(pedido)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.ghostBtnText}>Cancelar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18, paddingBottom: 28 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 },
  sub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  supportBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: 5,
    marginBottom: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabActive: { backgroundColor: colors.navy },
  tabText: { fontSize: 11, fontWeight: '800', color: colors.muted },
  tabTextActive: { color: colors.white },
  center: { paddingVertical: 60, alignItems: 'center' },
  list: { gap: 10 },
  card: {
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 9,
  },
  statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  statusText: { fontSize: 9, fontWeight: '900' },
  date: { fontSize: 10, fontWeight: '700', color: colors.muted },
  cardTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  cardText: { marginTop: 4, fontSize: 11, lineHeight: 16, color: colors.muted },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 9,
  },
  metaText: { flex: 1, fontSize: 10, color: colors.muted },
  metaPrice: { fontSize: 12, fontWeight: '900', color: colors.ink },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 11, fontWeight: '900', color: colors.navy },
  ghostBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { fontSize: 11, fontWeight: '800', color: colors.red },
  empty: {
    alignItems: 'center',
    padding: 28,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  emptyText: {
    marginTop: 5,
    maxWidth: 260,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  emptyBtn: {
    marginTop: 14,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontSize: 11, fontWeight: '900', color: colors.navy },
})
