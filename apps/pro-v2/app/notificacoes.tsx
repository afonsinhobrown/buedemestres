import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

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
  if (!jobId) return '/trabalhos'

  if (['price_agreed', 'payment_held', 'addendum_paid', 'payment_confirmed'].includes(notification.type)) {
    return { pathname: '/trabalho/aguardar-pagamento', params: { jobId } }
  }
  if (['price_proposed', 'contra_proposta', 'negotiation_expired'].includes(notification.type)) {
    return { pathname: '/trabalho/propor-preco', params: { jobId } }
  }
  if (['job_finished', 'dispute_opened', 'dispute_resolved', 'addendum_requested'].includes(notification.type)) {
    return { pathname: '/trabalho/aguardar-pagamento', params: { jobId } }
  }
  return '/trabalhos'
}

export default function ProNotificacoesScreen() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id || ''
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
      .channel(`pro_notifications_${userId}_${Date.now()}`)
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
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notification.id)
    }
    router.push(notificationRoute(notification) as any)
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
          <ActivityIndicator size="large" color="#F2C94C" />
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
  container: { flex: 1, backgroundColor: '#0F2D1A' },
  header: { paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.2)' },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#F2C94C', fontSize: 14, fontWeight: '800' },
  title: { color: '#F5F0E8', fontSize: 26, fontWeight: '900' },
  sub: { color: '#F2C94C', fontSize: 13, marginTop: 2 },
  markAll: { marginTop: 10, alignSelf: 'flex-start' },
  markAllText: { color: '#F2C94C', fontSize: 12, fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40 },
  card: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  cardUnread: { borderColor: '#F2C94C', borderWidth: 1.5, backgroundColor: 'rgba(242,201,76,0.08)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { flex: 1, color: '#F5F0E8', fontWeight: '900', fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginLeft: 8 },
  cardBody: { color: '#CBD5E1', fontSize: 13, lineHeight: 18 },
  cardTime: { color: '#94A3B8', fontSize: 11, marginTop: 6 },
})
