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
import { Alert } from '../lib/alertCompat'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'
import { BrandMark } from '../components/v2'
import { colors, radius, shadows, formatMoney } from '../lib/theme'

type JobPayment = {
  amount: number | null
  commission_amount: number | null
  commission_from_wallet: number | null
  provider_payout: number | null
  status: string
}
type JobRow = {
  id: string
  request_id: string | null
  agreed_amount: number | null
  updated_at: string
  service_requests?: { title?: string } | { title?: string }[] | null
  job_payments?: JobPayment | JobPayment[] | null
}
type PayoutRow = {
  id: string
  job_id: string | null
  amount: number
  status: string
  method: string | null
  created_at: string
}

function payoutStatusLabel(status: string) {
  if (status === 'completed') return { label: 'Pago', color: colors.green }
  if (status === 'processing') return { label: 'Em processamento', color: '#6B5300' }
  if (status === 'failed') return { label: 'Falhou', color: colors.red }
  return { label: 'Pedido enviado', color: '#6B5300' }
}

export default function CarteiraScreen() {
  const user = useAuthStore((s) => s.user)
  const provider = useAuthStore((s) => s.providerProfile)
  const providerId = provider?.profile_id || user?.id || ''

  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [earnings, setEarnings] = useState(0)
  const [debt, setDebt] = useState(0)
  const [hasAccount, setHasAccount] = useState(false)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [requesting, setRequesting] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!providerId) {
      setLoading(false)
      return
    }
    try {
      const [{ data: wallet }, { data: account }, { data: jobRows }, { data: payoutRows }] =
        await Promise.all([
          supabase
            .from('wallets')
            .select('balance, earnings_balance, platform_debt')
            .eq('profile_id', providerId)
            .maybeSingle(),
          supabase
            .from('provider_payout_accounts')
            .select('profile_id')
            .eq('profile_id', providerId)
            .maybeSingle(),
          supabase
            .from('jobs')
            .select(
              'id, request_id, agreed_amount, updated_at, service_requests:request_id(title), job_payments:job_payments(amount, commission_amount, commission_from_wallet, provider_payout, status)'
            )
            .eq('provider_id', providerId)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false }),
          supabase
            .from('payouts')
            .select('id, job_id, amount, status, method, created_at')
            .eq('provider_id', providerId)
            .order('created_at', { ascending: false }),
        ])
      setBalance(Number(wallet?.balance || 0))
      setEarnings(Number(wallet?.earnings_balance || 0))
      setDebt(Number(wallet?.platform_debt || 0))
      setHasAccount(Boolean(account?.profile_id))
      setJobs((jobRows as unknown as JobRow[]) || [])
      setPayouts((payoutRows as PayoutRow[]) || [])
    } catch (err) {
      console.warn('Erro ao carregar carteira:', err)
    } finally {
      setLoading(false)
    }
  }, [providerId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const pedirPagamento = async (job: JobRow) => {
    if (!hasAccount) {
      Alert.alert(
        'Dados de pagamento',
        'Antes de pedir o pagamento precisas de indicar os teus dados de e-Mola, M-Pesa ou banco.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Configurar', onPress: () => router.push('/dados-pagamento') },
        ]
      )
      return
    }

    Alert.alert(
      'Solicitar pagamento',
      'O valor será calculado automaticamente pelo sistema e enviado para os teus dados de pagamento. Confirmas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solicitar',
          onPress: async () => {
            try {
              setRequesting(job.id)
              const { error } = await supabase.rpc('request_job_payout', { p_job: job.id })
              if (error) {
                const msg = String(error.message || '')
                if (msg.includes('payout_account_missing')) {
                  Alert.alert(
                    'Dados em falta',
                    'Configura os teus dados de pagamento primeiro.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Configurar', onPress: () => router.push('/dados-pagamento') },
                    ]
                  )
                  return
                }
                if (msg.includes('already_requested')) {
                  Alert.alert('Já solicitado', 'Este serviço já tem um pedido de pagamento.')
                  await carregar()
                  return
                }
                if (msg.includes('payment_not_released') || msg.includes('job_not_completed')) {
                  Alert.alert(
                    'Ainda não disponível',
                    'Este valor ainda não está disponível para saque.'
                  )
                  await carregar()
                  return
                }
                throw error
              }
              Alert.alert(
                'Pedido enviado',
                'O teu pedido de pagamento foi registado. O estado será actualizado aqui.'
              )
              await carregar()
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Não foi possível solicitar o pagamento.')
            } finally {
              setRequesting(null)
            }
          },
        },
      ]
    )
  }

  const resumo = jobs.reduce(
    (acc, job) => {
      const rawPayment = job.job_payments
      const payment = Array.isArray(rawPayment) ? rawPayment[0] : rawPayment
      const payout = payouts.find((p) => p.job_id === job.id)
      const bruto = Number(payment?.amount || job.agreed_amount || 0)
      const liquido = Number(payment?.provider_payout || 0)
      acc.faturacao += bruto
      acc.comissao +=
        Number(payment?.commission_amount || 0) +
        Number(payment?.commission_from_wallet || 0)
      if (payout?.status === 'completed') acc.pago += liquido
      else acc.devido += liquido
      return acc
    },
    { faturacao: 0, comissao: 0, pago: 0, devido: 0 }
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <BrandMark size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Carteira</Text>
            <Text style={styles.sub}>Ganhos, comissões e pagamentos.</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/carregar')}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>＋ Saldo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>GANHOS DISPONÍVEIS</Text>
          <Text style={styles.heroValue}>{formatMoney(earnings)}</Text>
          <Text style={styles.heroHint}>O valor dos serviços concluídos e já libertados.</Text>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroSmallLabel}>SALDO DE OPERAÇÃO</Text>
              <Text style={styles.heroSmallValue}>{formatMoney(balance)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroSmallLabel}>DÍVIDA</Text>
              <Text
                style={[
                  styles.heroSmallValue,
                  debt > 0 && { color: '#FCA5A5' },
                ]}
              >
                {formatMoney(debt)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.accountRow}>
          <Text style={styles.accountText}>
            {hasAccount
              ? 'Dados de pagamento configurados.'
              : 'Ainda não tens dados de pagamento.'}
          </Text>
          <TouchableOpacity onPress={() => router.push('/dados-pagamento')}>
            <Text style={styles.accountLink}>
              {hasAccount ? 'Alterar' : 'Configurar'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryHalf}>
            <Text style={styles.summaryLabel}>FATURAÇÃO</Text>
            <Text style={styles.summaryValue}>{formatMoney(resumo.faturacao)}</Text>
          </View>
          <View style={styles.summaryHalf}>
            <Text style={styles.summaryLabel}>COMISSÕES</Text>
            <Text style={styles.summaryValue}>{formatMoney(resumo.comissao)}</Text>
          </View>
          <View style={styles.summaryHalf}>
            <Text style={styles.summaryLabel}>PAGO</Text>
            <Text style={[styles.summaryValue, { color: colors.green }]}>
              {formatMoney(resumo.pago)}
            </Text>
          </View>
          <View style={styles.summaryHalf}>
            <Text style={styles.summaryLabel}>POR RECEBER</Text>
            <Text style={[styles.summaryValue, { color: '#6B5300' }]}>
              {formatMoney(resumo.devido)}
            </Text>
          </View>
        </View>

        {debt > 0 && (
          <TouchableOpacity
            style={styles.debtCard}
            onPress={() => router.push('/carregar')}
            activeOpacity={0.85}
          >
            <Text style={styles.debtTitle}>Comissão em dívida</Text>
            <Text style={styles.debtText}>
              Tens {formatMoney(debt)} de comissão por regularizar. Carrega saldo para voltares a
              operar.
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Serviços concluídos</Text>

        {jobs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Ainda não tens serviços concluídos.</Text>
            <Text style={styles.emptyText}>
              Quando concluíres um trabalho, o pagamento aparece aqui.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {jobs.map((job) => {
              const payout = payouts.find((p) => p.job_id === job.id)
              const rawPayment = job.job_payments
              const payment = Array.isArray(rawPayment) ? rawPayment[0] : rawPayment
              const rawRequest = job.service_requests
              const request = Array.isArray(rawRequest) ? rawRequest[0] : rawRequest
              const amount = Number(payment?.provider_payout || job.agreed_amount || 0)
              const bruto = Number(payment?.amount || job.agreed_amount || 0)
              const comissao =
                Number(payment?.commission_amount || 0) +
                Number(payment?.commission_from_wallet || 0)
              const released = payment?.status === 'released'
              return (
                <View key={job.id} style={styles.jobCard}>
                  <View style={styles.jobTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jobTitle}>{request?.title || 'Serviço concluído'}</Text>
                      <Text style={styles.jobDate}>
                        Fatura #{job.id.slice(0, 8).toUpperCase()} ·{' '}
                        {new Date(job.updated_at).toLocaleDateString('pt-MZ')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.jobAmount}>{formatMoney(amount)}</Text>
                      {payout ? (
                        <Text
                          style={[
                            styles.jobStatus,
                            { color: payoutStatusLabel(payout.status).color },
                          ]}
                        >
                          {payoutStatusLabel(payout.status).label}
                        </Text>
                      ) : released ? (
                        <Text style={[styles.jobStatus, { color: colors.blue }]}>Por pagar</Text>
                      ) : (
                        <Text style={styles.jobStatus}>Aguarda confirmação</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.jobBreakdown}>
                    Bruto {formatMoney(bruto)} · Comissão {formatMoney(comissao)}
                  </Text>
                  {!payout && released && (
                    <TouchableOpacity
                      style={[styles.payBtn, requesting === job.id && { opacity: 0.6 }]}
                      onPress={() => pedirPagamento(job)}
                      disabled={requesting === job.id}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.payBtnText}>
                        {requesting === job.id ? 'A solicitar...' : 'Solicitar pagamento'}
                      </Text>
                    </TouchableOpacity>
                  )}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 },
  sub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.soft,
  },
  addBtnText: { fontSize: 10, fontWeight: '900', color: colors.blue },
  hero: {
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.navy,
    marginBottom: 12,
    ...shadows.card,
  },
  heroLabel: { color: '#9DB4D4', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroValue: { marginTop: 4, color: colors.white, fontSize: 30, fontWeight: '900' },
  heroHint: { marginTop: 3, color: '#C8D3E6', fontSize: 11, lineHeight: 16 },
  heroRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  heroSmallLabel: { color: '#9DB4D4', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  heroSmallValue: { marginTop: 3, color: colors.white, fontSize: 14, fontWeight: '900' },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
  },
  accountText: { flex: 1, fontSize: 11, color: colors.muted },
  accountLink: { fontSize: 11, fontWeight: '900', color: colors.blue },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 14,
  },
  summaryHalf: {
    width: '48.5%',
    flexGrow: 1,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  summaryLabel: { fontSize: 8, fontWeight: '900', color: colors.muted, letterSpacing: 0.6 },
  summaryValue: { marginTop: 4, fontSize: 14, fontWeight: '900', color: colors.ink },
  debtCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.redSoft,
    borderWidth: 1,
    borderColor: '#F3B7A7',
  },
  debtTitle: { fontSize: 12, fontWeight: '900', color: colors.red },
  debtText: { marginTop: 4, fontSize: 11, lineHeight: 16, color: '#7A2E15' },
  sectionTitle: {
    marginBottom: 9,
    fontSize: 10,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  list: { gap: 10 },
  empty: {
    padding: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 13, fontWeight: '900', color: colors.ink },
  emptyText: { marginTop: 4, fontSize: 11, color: colors.muted, textAlign: 'center' },
  jobCard: {
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  jobTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  jobTitle: { fontSize: 13, fontWeight: '900', color: colors.ink },
  jobDate: { marginTop: 3, fontSize: 10, color: colors.muted },
  jobAmount: { fontSize: 14, fontWeight: '900', color: colors.ink },
  jobStatus: { marginTop: 3, fontSize: 10, fontWeight: '800', color: colors.muted },
  jobBreakdown: { marginTop: 8, fontSize: 10, color: colors.muted },
  payBtn: {
    marginTop: 10,
    minHeight: 40,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: { fontSize: 11, fontWeight: '900', color: colors.white },
})
