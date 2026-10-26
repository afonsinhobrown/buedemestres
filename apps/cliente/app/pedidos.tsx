import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, ActivityIndicator, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/useAuthStore'
import { Alert } from '@/lib/alertCompat'

export default function PedidosScreen() {
  const profile = useAuthStore(s => s.profile)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [tab, setTab] = useState<'todos' | 'ativos' | 'concluidos'>('ativos')

  const clientId = profile?.id || ''

  const carregarPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          id,
          title,
          description,
          location_note,
          status,
          budget_max,
          target_provider_id,
          created_at,
          category_id
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setPedidos(data)
      }
    } catch (err) {
      console.warn('Erro ao carregar histórico de pedidos:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    carregarPedidos()

    // Subscrição em tempo real para novos pedidos ou alterações de estado
    const channel = supabase
      .channel(`client_orders_${clientId}_${Date.now()}`)
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

  const pedidosFiltrados = pedidos.filter(p => {
    const isAtivo = ['open', 'accepted', 'price_proposed', 'in_progress', 'en_route', 'arrived'].includes(p.status)
    if (tab === 'ativos') return isAtivo
    if (tab === 'concluidos') return p.status === 'completed' || p.status === 'cancelled'
    return true
  })

  const getStatusBadge = (status: string, budget?: number) => {
    switch (status) {
      case 'price_proposed':
        return {
          label: `🔔 ORÇAMENTO RECEBIDO: ${budget ? `MT ${budget}` : 'ANALISAR'}`,
          bg: '#FEF08A',
          color: '#854D0E',
          border: '#CA8A04'
        }
      case 'accepted':
        return {
          label: '🟡 MESTRE A ANALISAR',
          bg: '#FEF3C7',
          color: '#92400E',
          border: '#F59E0B'
        }
      case 'open':
        return {
          label: '🔵 A PROCURAR MESTRE',
          bg: '#DBEAFE',
          color: '#1E40AF',
          border: '#3B82F6'
        }
      case 'en_route':
        return {
          label: '🚗 MESTRE A CAMINHO',
          bg: '#DCFCE7',
          color: '#166534',
          border: '#22C55E'
        }
      case 'arrived':
        return {
          label: '📍 MESTRE NO LOCAL',
          bg: '#DCFCE7',
          color: '#166534',
          border: '#22C55E'
        }
      case 'in_progress':
        return {
          label: '⚙️ EM EXECUÇÃO',
          bg: '#E0E7FF',
          color: '#3730A3',
          border: '#6366F1'
        }
      case 'completed':
        return {
          label: '✅ CONCLUÍDO',
          bg: '#DCFCE7',
          color: '#166534',
          border: '#22C55E'
        }
      case 'cancelled':
        return {
          label: '✕ CANCELADO',
          bg: '#FEE2E2',
          color: '#991B1B',
          border: '#EF4444'
        }
      default:
        return {
          label: status.toUpperCase(),
          bg: '#F3F4F6',
          color: '#374151',
          border: '#9CA3AF'
        }
    }
  }

  const formatTitle = (title?: string) => {
    if (!title || title.includes('undefined')) return 'Pedido de Assistência';
    return title;
  };

  const retomarPedido = async (p: any) => {
    // O estado do job é a fonte de verdade. O service_requests pode ter ficado
    // dessincronizado (ex.: aceite por oferta sem target_provider_id) e nesse
    // caso o cliente era enviado de volta para "A procurar mestre".
    try {
      const { data: job } = await supabase
        .from('jobs')
        .select('id, status')
        .eq('request_id', p.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (job) {
        if (job.status === 'accepted' || job.status === 'price_proposed' || job.status === 'puxado') {
          router.push({
            pathname: '/pedido/proposta-preco',
            params: { jobId: job.id, categoriaEmoji: '🔧' }
          })
          return
        }
        if (['price_agreed', 'en_route', 'arrived', 'in_service', 'in_progress', 'awaiting_confirmation'].includes(job.status)) {
          router.push({
            pathname: '/pedido/mestre-a-caminho',
            params: { jobId: job.id }
          })
          return
        }
      }
    } catch (err) {
      console.warn('Erro ao resolver o trabalho do pedido:', err)
    }

    if (p.status === 'price_proposed' || p.status === 'accepted' || p.status === 'puxado') {
      router.push({
        pathname: '/pedido/proposta-preco',
        params: { jobId: p.id, categoriaEmoji: '🔧' }
      })
    } else if (p.status === 'en_route' || p.status === 'arrived' || p.status === 'in_progress') {
      router.push({
        pathname: '/pedido/mestre-a-caminho',
        params: { jobId: p.id }
      })
    } else if (p.status === 'open') {
      router.push({
        pathname: '/pedido/a-procurar',
        params: {
          requestId: p.id,
          categoriaId: (p.category_id || 2).toString(),
          categoriaNome: p.title || 'Mestre',
          descricao: p.description || '',
          referencia: p.location_note || ''
        }
      })
    }
  }

  const estornarPedidoPago = async (jobId: string, destino: 'wallet' | 'paysuite') => {
    const { data, error } = await supabase.rpc('cancel_job_by_client', {
      p_job: jobId,
      p_destination: destino
    })
    if (error || (data && data.ok === false)) {
      Alert.alert('Erro', error?.message || data?.error || 'Não foi possível cancelar o pedido.')
      return
    }
    await carregarPedidos()
  }

  const cancelarPedido = async (p: any) => {
    // Pedido já pago (escrow retido): o cliente pode cancelar e escolher o
    // destino do estorno. Se o mestre já se deslocou, é-lhe aplicada multa.
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
          'O teu pagamento está retido. Vais cancelar e procurar outro mestre. Onde queres receber o estorno?',
          [
            { text: 'Voltar', style: 'cancel' },
            { text: 'Na minha carteira', onPress: () => estornarPedidoPago(job.id, 'wallet') },
            { text: 'M-Pesa / eMola', onPress: () => estornarPedidoPago(job.id, 'paysuite') }
          ]
        )
        return
      }
    } catch (err) {
      console.warn('Erro ao verificar pagamento do pedido:', err)
    }

    Alert.alert(
      'Cancelar pedido',
      'Queres mesmo cancelar este pedido? Deixa de contar para o limite de pedidos activos.',
      [
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
          }
        }
      ]
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF0F2" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>← Voltar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/suporte')} style={styles.supportChip} activeOpacity={0.7}>
            <Text style={styles.supportChipText}>🎧 Suporte</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Os Meus Pedidos</Text>
        <Text style={styles.headerSub}>Recupere pedidos em curso ou consulte o histórico de reparações</Text>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, tab === 'ativos' && styles.tabBtnActive]} 
            onPress={() => setTab('ativos')}
          >
            <Text style={[styles.tabText, tab === 'ativos' && styles.tabTextActive]}>Em Andamento</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, tab === 'concluidos' && styles.tabBtnActive]} 
            onPress={() => setTab('concluidos')}
          >
            <Text style={[styles.tabText, tab === 'concluidos' && styles.tabTextActive]}>Histórico</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, tab === 'todos' && styles.tabBtnActive]} 
            onPress={() => setTab('todos')}
          >
            <Text style={[styles.tabText, tab === 'todos' && styles.tabTextActive]}>Todos ({pedidos.length})</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2444C8" />
          <Text style={styles.loadingText}>A carregar os seus pedidos...</Text>
        </View>
      ) : pedidosFiltrados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Nenhum pedido encontrado</Text>
          <Text style={styles.emptySub}>
            {tab === 'ativos' 
              ? 'Não tem nenhum pedido a decorrer neste momento.' 
              : 'Ainda não tem pedidos registados no histórico.'}
          </Text>
          <TouchableOpacity style={styles.btnNovo} onPress={() => router.push('/')}>
            <Text style={styles.btnNovoText}>+ Pedir um Mestre Agora</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarPedidos(); }} />}
        >
          {pedidosFiltrados.map((p) => {
            const badge = getStatusBadge(p.status, p.budget_max)
            const isAtivo = ['open', 'accepted', 'price_proposed', 'in_progress', 'en_route', 'arrived'].includes(p.status)
            const dataFormatada = new Date(p.created_at).toLocaleString('pt-PT', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })

            return (
              <View key={p.id} style={[styles.orderCard, p.status === 'price_proposed' && styles.orderCardHighlight]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{formatTitle(p.title)}</Text>
                    <Text style={styles.cardDate}>🕒 {dataFormatada}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>

                {p.description && (
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    "{p.description}"
                  </Text>
                )}

                {p.location_note && (
                  <Text style={styles.cardLocation}>
                    📍 Ref: {p.location_note}
                  </Text>
                )}

                {/* Acções do Pedido */}
                <View style={styles.actionsRow}>
                  {isAtivo ? (
                    <TouchableOpacity 
                      style={[styles.btnActionPrimary, p.status === 'price_proposed' && { backgroundColor: '#F2C94C' }]} 
                      onPress={() => retomarPedido(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.btnActionPrimaryText, p.status === 'price_proposed' && { color: '#12163A' }]}>
                        {p.status === 'price_proposed' 
                          ? '🔔 VER ORÇAMENTO & DECIDIR →' 
                          : 'ACOMPANHAR PEDIDO →'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.btnActionSecondary}
                      onPress={() => router.push(`/pedido/novo?categoria=mecanico`)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnActionSecondaryText}>🔄 Pedir Novamente</Text>
                    </TouchableOpacity>
                  )}

                  {(p.status === 'open' || p.status === 'in_negotiation' || p.status === 'accepted') && (
                    <TouchableOpacity
                      style={styles.btnCancelOrder}
                      onPress={() => cancelarPedido(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnCancelOrderText}>✕ Cancelar</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={styles.btnSupport}
                    onPress={() => router.push({ pathname: '/suporte', params: { jobId: p.id, assunto: p.title } })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnSupportText}>🎧 Ajuda</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EDF0F2' },
  header: { backgroundColor: '#12163A', padding: 20, paddingTop: 28 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  backBtnText: { color: '#FFC61A', fontSize: 15, fontWeight: '800' },
  supportChip: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  supportChipText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#DCE3FA', fontSize: 13, marginTop: 4, marginBottom: 16 },
  
  tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#FFC61A' },
  tabText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#12163A', fontWeight: '900' },

  listContent: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#5B6472', fontWeight: '600' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#12163A', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#5B6472', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  btnNovo: { backgroundColor: '#2444C8', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10, borderWidth: 2, borderColor: '#12163A' },
  btnNovoText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#12163A',
    shadowColor: '#12163A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  orderCardHighlight: {
    borderColor: '#CA8A04',
    backgroundColor: '#FEFCE8',
    borderWidth: 2.5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '900', color: '#12163A', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '900' },

  cardDesc: { fontSize: 14, color: '#374151', fontStyle: 'italic', marginBottom: 8, lineHeight: 18 },
  cardLocation: { fontSize: 12, color: '#4B5563', marginBottom: 14, fontWeight: '600' },

  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnActionPrimary: {
    flex: 1,
    backgroundColor: '#2444C8',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#12163A',
  },
  btnActionPrimaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  btnActionSecondary: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  btnActionSecondaryText: { color: '#1F2937', fontWeight: '800', fontSize: 13 },
  btnCancelOrder: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  btnCancelOrderText: { color: '#B91C1C', fontWeight: '900', fontSize: 13 },
  btnSupport: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  btnSupportText: { color: '#4B5563', fontWeight: '800', fontSize: 13 },
})
