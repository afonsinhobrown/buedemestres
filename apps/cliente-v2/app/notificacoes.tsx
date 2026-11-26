import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/useAuthStore'
import { BrandMark } from '@/components/v2'
import { colors, radius, shadows } from '@/lib/theme'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  data: any
  read_at: string | null
  created_at: string
}

function notificationRoute(notification: Notification) {
  const data = notification.data || {}
  const jobId = data.job_id || data.jobId || data.requestId || data.request_id
  const addendumTypes = ['addendum_requested', 'addendum_failed', 'addendum_paid']
  const proposalTypes = ['price_proposed', 'contra_proposta', 'payment_failed', 'payment_confirmed']

  if (!jobId) return '/pedidos'
  if (addendumTypes.includes(notification.type)) {
    return { pathname: '/pedido/mestre-a-caminho', params: { jobId } }
  }
  if (proposalTypes.includes(notification.type)) {
    return { pathname: '/pedido/proposta-preco', params: { jobId } }
  }
  if (
    ['job_finished', 'payment_held', 'dispute_opened', 'dispute_resolved'].includes(
      notification.type
    )
  ) {
    return { pathname: '/pedido/mestre-a-caminho', params: { jobId } }
  }
  return { pathname: '/pedido/mestre-a-caminho', params: { jobId } }
}

function notificationIcon(type: string) {
  if (type.includes('payment')) return '💸'
  if (type.includes('proposal') || type.includes('price')) return '🧾'
  if (type.includes('dispute')) return '⚠️'
  if (type.includes('addendum')) return '➕'
  if (type.includes('job')) return '🔧'
  return '🔔'
}

export default function NotificacoesScreen() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const userId = user?.id || profile?.id || ''
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Notification[]>([])

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    let channel: ReturnType<typeof supabase.channel> | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const carregar = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('profile_id', userId)
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) console.warn('Erro ao carregar notificações:', error.message)
        setItems((data as Notification[]) || [])
      } catch (err) {
        console.warn('Erro ao carregar notificações:', err)
      } finally {
        setLoading(false)
      }
    }

    carregar()
    pollTimer = setInterval(carregar, 5000)

    channel = supabase
      .channel(`notifications_${userId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `profile_id=eq.${userId}` },
        () => carregar()
      )
      .subscribe()

    return () => {
      if (pollTimer) clearInterval(pollTimer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [userId])

  const abrir = async (notification: Notification) => {
    if (!notification.read_at) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notification.id)
    }
    const route = notificationRoute(notification)
    router.push(route as any)
  }

  const marcarTodas = async () => {
    if (!userId) return
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', userId)
      .is('read_at', null)
  }

  const naoLidas = items.filter((item) => !item.read_at).length

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <BrandMark size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Notificações</Text>
            <Text style={styles.sub}>
              {naoLidas > 0 ? `${naoLidas} não lidas` : 'Estás em dia'}
            </Text>
          </View>
          {naoLidas > 0 && (
            <TouchableOpacity style={styles.markAll} onPress={marcarTodas} activeOpacity={0.8}>
              <Text style={styles.markAllText}>Marcar lidas</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.blue} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={{ fontSize: 26 }}>🔔</Text>
            </View>
            <Text style={styles.emptyTitle}>Ainda não tens notificações</Text>
            <Text style={styles.emptyText}>
              Avisos de orçamentos, pagamentos e trabalhos aparecem aqui.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, !item.read_at && styles.cardUnread]}
                onPress={() => abrir(item)}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <View style={styles.cardIcon}>
                  <Text style={{ fontSize: 18 }}>{notificationIcon(item.type)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {!item.read_at && <View style={styles.dot} />}
                  </View>
                  {item.body ? <Text style={styles.cardBody}>{item.body}</Text> : null}
                  <Text style={styles.cardTime}>
                    {new Date(item.created_at).toLocaleString('pt-MZ', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text style={styles.cardArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18, paddingBottom: 28 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  title: { fontSize: 20, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 },
  sub: { fontSize: 11, fontWeight: '600', color: colors.muted, marginTop: 2 },
  markAll: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.soft,
  },
  markAllText: { color: colors.blue, fontSize: 10, fontWeight: '900' },
  center: { paddingVertical: 60, alignItems: 'center' },
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
  list: { gap: 9 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardUnread: { borderColor: colors.blue, backgroundColor: '#F8FAFF' },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '900', color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  cardBody: { marginTop: 4, fontSize: 11, lineHeight: 16, color: colors.muted },
  cardTime: { marginTop: 6, fontSize: 10, color: colors.muted },
  cardArrow: { alignSelf: 'center', fontSize: 14, fontWeight: '900', color: colors.muted },
})
