import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/useAuthStore'

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
  if (addendumTypes.includes(notification.type)) return { pathname: '/pedido/mestre-a-caminho', params: { jobId } }
  if (proposalTypes.includes(notification.type)) return { pathname: '/pedido/proposta-preco', params: { jobId } }
  if (['job_finished', 'payment_held', 'dispute_opened', 'dispute_resolved'].includes(notification.type)) {
    return { pathname: '/pedido/mestre-a-caminho', params: { jobId } }
  }
  return { pathname: '/pedido/mestre-a-caminho', params: { jobId } }
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

    const carregar = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)
      setItems((data as Notification[]) || [])
      setLoading(false)
    }

    carregar()

    channel = supabase
      .channel(`notifications_${userId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `profile_id=eq.${userId}` },
        () => carregar()
      )
      .subscribe()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [userId])

  const abrir = async (notification: Notification) => {
    if (!notification.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notification.id)
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notificações</Text>
        <Text style={styles.sub}>{naoLidas > 0 ? `${naoLidas} não lidas` : 'Estás em dia'}</Text>
        {naoLidas > 0 && (
          <TouchableOpacity style={styles.markAll} onPress={marcarTodas}>
            <Text style={styles.markAllText}>Marcar todas como lidas</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2444C8" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.length === 0 ? (
            <Text style={styles.empty}>Ainda não tens notificações.</Text>
          ) : (
            items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, !item.read_at && styles.cardUnread]}
                onPress={() => abrir(item)}
                activeOpacity={0.8}
              >
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
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDF0F2' },
  header: { backgroundColor: '#12163A', paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#FFC61A', fontSize: 14, fontWeight: '800' },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  sub: { color: '#DCE3FA', fontSize: 13, marginTop: 2 },
  markAll: { marginTop: 10, alignSelf: 'flex-start' },
  markAllText: { color: '#FFC61A', fontSize: 12, fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  cardUnread: { borderColor: '#2444C8', borderWidth: 1.5, backgroundColor: '#F8FAFF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { flex: 1, color: '#12163A', fontWeight: '900', fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626', marginLeft: 8 },
  cardBody: { color: '#4B5563', fontSize: 13, lineHeight: 18 },
  cardTime: { color: '#9CA3AF', fontSize: 11, marginTop: 6 },
})
