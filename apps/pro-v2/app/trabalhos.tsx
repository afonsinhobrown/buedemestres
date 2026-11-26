import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'
import { BrandMark } from '../components/v2'
import { colors, radius, shadows } from '../lib/theme'

const ACTIVE_STATUSES = ['accepted', 'price_proposed', 'puxado', 'price_agreed', 'en_route', 'arrived', 'in_service']

type JobRow = {
  id: string
  request_id: string | null
  status: string
  price_proposed: number | null
  price_estimate_min: number | null
  agreed_amount: number | null
  turn_owner: string | null
  turn_expires_at: string | null
  negotiation_state: string | null
  service_requests?: { title?: string; budget_max?: number | null; urgency?: string } | null
}

const STATUS_INFO: Record<string, { label: string; emoji: string; color: string; bg: string; hint: string }> = {
  accepted: { label: 'Aceite — propor orçamento', emoji: '📝', color: '#2444C8', bg: '#E9EEFF', hint: 'Envia o teu orçamento ao cliente' },
  price_proposed: { label: 'Orçamento enviado', emoji: '⏳', color: '#6B5300', bg: '#FFF4CC', hint: 'À espera da resposta do cliente' },
  puxado: { label: 'Contra-proposta', emoji: '💬', color: '#6B5300', bg: '#FFF4CC', hint: 'O cliente fez uma contra-proposta' },
  price_agreed: { label: 'Acordo fechado', emoji: '🔒', color: colors.green, bg: colors.greenSoft, hint: 'Pagamento retido em segurança' },
  en_route: { label: 'A caminho', emoji: '🚗', color: '#2444C8', bg: '#E9EEFF', hint: 'Deslocação em curso' },
  arrived: { label: 'No local', emoji: '📍', color: '#2444C8', bg: '#E9EEFF', hint: 'Chegaste ao cliente' },
  in_service: { label: 'Serviço em curso', emoji: '🔧', color: colors.green, bg: colors.greenSoft, hint: 'Trabalho a decorrer' },
}

function statusInfo(status: string) {
  return (
    STATUS_INFO[status] || {
      label: status,
      emoji: '•',
      color: colors.muted,
      bg: colors.paper,
      hint: '',
    }
  )
}

export default function TrabalhosScreen() {
  const router = useRouter()
  const user = useAuthStore((s: any) => s.user)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [stats, setStats] = useState<{ abandon_count?: number; cooldown_until?: string | null } | null>(null)

  const resolverProvider = useCallback(async () => user?.id || null, [user])

  const carregar = useCallback(async (providerId: string) => {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, request_id, status, price_proposed, price_estimate_min, agreed_amount, turn_owner, turn_expires_at, negotiation_state, service_requests:request_id ( title, budget_max, urgency )'
      )
      .eq('provider_id', providerId)
      .in('status', ACTIVE_STATUSES)
      .order('updated_at', { ascending: false })
    if (error) console.warn('Erro ao carregar trabalhos:', error.message)
    setJobs((data as JobRow[]) || [])
  }, [])

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>
    let channel: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      const providerId = await resolverProvider()
      if (!providerId) {
        setLoading(false)
        return
      }
      await supabase.rpc('expire_stale_negotiations').then(
        () => {},
        () => {}
      )
      await carregar(providerId)
      const { data: st } = await supabase
        .from('reliability_stats')
        .select('abandon_count, cooldown_until')
        .eq('profile_id', providerId)
        .maybeSingle()
      setStats(st || null)
      setLoading(false)

      pollTimer = setInterval(() => carregar(providerId), 3000)
      channel = supabase
        .channel(`pro_jobs_v2_${providerId}_${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () =>
          carregar(providerId)
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_price_proposals' }, () =>
          carregar(providerId)
        )
        .subscribe()
    })()

    return () => {
      if (pollTimer) clearInterval(pollTimer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [resolverProvider, carregar])

  const abrir = (job: JobRow) => {
    const target = job.request_id || job.id
    if (job.status === 'accepted') {
      router.push(`/trabalho/propor-preco?jobId=${target}`)
    } else if (job.status === 'en_route' || job.status === 'arrived') {
      router.push(`/trabalho/a-caminho?jobId=${job.id}`)
    } else if (job.status === 'in_service') {
      router.push(`/trabalho/em-curso?jobId=${job.id}`)
    } else {
      router.push(`/trabalho/aguardar-pagamento?jobId=${job.id}`)
    }
  }

  const cooldownActive =
    stats?.cooldown_until && new Date(stats.cooldown_until).getTime() > Date.now()

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <BrandMark size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Os meus trabalhos</Text>
            <Text style={styles.sub}>Tudo o que está em curso contigo.</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{jobs.length}</Text>
          </View>
        </View>

        {cooldownActive && (
          <View style={styles.cooldown}>
            <Text style={styles.cooldownTitle}>⚠️ Temporariamente suspenso</Text>
            <Text style={styles.cooldownText}>
              Não respondeste a tempo várias vezes. Podes voltar a aceitar pedidos às{' '}
              {new Date(stats.cooldown_until as string).toLocaleTimeString('pt-MZ', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              .
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.blue} />
          </View>
        ) : jobs.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={{ fontSize: 26 }}>🛠️</Text>
            </View>
            <Text style={styles.emptyTitle}>Nenhum trabalho em curso</Text>
            <Text style={styles.emptyText}>
              Quando aceitares um pedido, ele aparece aqui — mesmo depois de sair do ecrã.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Voltar ao início</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {jobs.map((job) => {
              const info = statusInfo(job.status)
              const titulo = job.service_requests?.title || 'Serviço'
              const valor = job.agreed_amount ?? job.price_proposed ?? job.price_estimate_min
              return (
                <TouchableOpacity
                  key={job.id}
                  style={styles.card}
                  onPress={() => abrir(job)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.cardIcon, { backgroundColor: info.bg }]}>
                      <Text style={{ fontSize: 19 }}>{info.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{titulo}</Text>
                      <Text style={[styles.cardStatus, { color: info.color }]}>
                        {info.label}
                      </Text>
                    </View>
                    {valor ? (
                      <Text style={styles.cardValue}>
                        MT {Number(valor).toLocaleString('pt-MZ')}
                      </Text>
                    ) : null}
                  </View>
                  {info.hint ? <Text style={styles.cardHint}>{info.hint}</Text> : null}
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardCta}>Abrir trabalho</Text>
                    <Text style={styles.cardArrow}>→</Text>
                  </View>
                </TouchableOpacity>
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
  countPill: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  countText: { color: colors.blue, fontSize: 14, fontWeight: '900' },
  cooldown: {
    marginBottom: 14,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.redSoft,
    borderWidth: 1,
    borderColor: '#F3B7A7',
  },
  cooldownTitle: { color: colors.red, fontSize: 12, fontWeight: '900' },
  cooldownText: { marginTop: 4, color: '#7A2E15', fontSize: 11, lineHeight: 16 },
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
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '900', color: colors.ink },
  cardStatus: { marginTop: 3, fontSize: 11, fontWeight: '800' },
  cardValue: { fontSize: 14, fontWeight: '900', color: colors.ink },
  cardHint: { marginTop: 9, fontSize: 11, lineHeight: 16, color: colors.muted },
  cardFooter: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCta: { fontSize: 11, fontWeight: '900', color: colors.blue },
  cardArrow: { fontSize: 15, fontWeight: '900', color: colors.blue },
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
    maxWidth: 270,
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
