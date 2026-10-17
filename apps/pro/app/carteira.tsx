import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { Alert } from '../lib/alertCompat'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

type JobPayment = { provider_payout: number | null; status: string }
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
  if (status === 'completed') return { label: 'Pago', color: '#4ADE80' }
  if (status === 'processing') return { label: 'Em processamento', color: '#F2C94C' }
  if (status === 'failed') return { label: 'Falhou', color: '#F87171' }
  return { label: 'Pedido enviado — por pagar', color: '#F2C94C' }
}

export default function CarteiraScreen() {
  const user = useAuthStore((s) => s.user)
  const provider = useAuthStore((s) => s.providerProfile)
  const providerId = provider?.profile_id || user?.id || ''

  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
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
      const [{ data: wallet }, { data: account }, { data: jobRows }, { data: payoutRows }] = await Promise.all([
        supabase.from('wallets').select('balance').eq('profile_id', providerId).maybeSingle(),
        supabase.from('provider_payout_accounts').select('profile_id').eq('profile_id', providerId).maybeSingle(),
        supabase
          .from('jobs')
          .select('id, request_id, agreed_amount, updated_at, service_requests:request_id(title), job_payments:job_payments(provider_payout, status)')
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
                  Alert.alert('Dados em falta', 'Configura os teus dados de pagamento primeiro.', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Configurar', onPress: () => router.push('/dados-pagamento') },
                  ])
                  return
                }
                if (msg.includes('already_requested')) {
                  Alert.alert('Já solicitado', 'Este serviço já tem um pedido de pagamento.')
                  await carregar()
                  return
                }
                if (msg.includes('payment_not_released') || msg.includes('job_not_completed')) {
                  Alert.alert('Ainda não disponível', 'Este valor ainda não está disponível para saque.')
                  await carregar()
                  return
                }
                throw error
              }
              Alert.alert('Pedido enviado', 'O teu pedido de pagamento foi registado. O estado será actualizado aqui.')
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F2C94C" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Ganhos & Pagamentos</Text>
      <Text style={styles.sub}>O valor de cada serviço é calculado pelo sistema — não escreves o montante.</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>SALDO DISPONÍVEL</Text>
        <Text style={styles.balanceValue}>MT {balance.toLocaleString('pt-MZ')}</Text>
        <TouchableOpacity style={styles.accountBtn} onPress={() => router.push('/dados-pagamento')}>
          <Text style={styles.accountBtnText}>
            {hasAccount ? '✏️ Alterar dados de pagamento' : '＋ Configurar dados de pagamento'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>SERVIÇOS CONCLUÍDOS</Text>

      {jobs.length === 0 ? (
        <Text style={styles.empty}>Ainda não tens serviços concluídos.</Text>
      ) : (
        jobs.map((job) => {
          const payout = payouts.find((p) => p.job_id === job.id)
          const rawPayment = job.job_payments
          const payment = Array.isArray(rawPayment) ? rawPayment[0] : rawPayment
          const rawRequest = job.service_requests
          const request = Array.isArray(rawRequest) ? rawRequest[0] : rawRequest
          const amount = Number(payment?.provider_payout || job.agreed_amount || 0)
          const released = payment?.status === 'released'
          return (
            <View key={job.id} style={styles.jobCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobTitle}>{request?.title || 'Serviço concluído'}</Text>
                <Text style={styles.jobDate}>
                  {new Date(job.updated_at).toLocaleDateString('pt-MZ')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.jobAmount}>MT {amount.toLocaleString('pt-MZ')}</Text>
                {payout ? (
                  <Text style={[styles.jobStatus, { color: payoutStatusLabel(payout.status).color }]}>
                    {payoutStatusLabel(payout.status).label}
                  </Text>
                ) : released ? (
                  <Text style={[styles.jobStatus, { color: '#38BDF8' }]}>Por pagar</Text>
                ) : (
                  <Text style={[styles.jobStatus, { color: '#94A3B8' }]}>Aguarda confirmação</Text>
                )}
              </View>
              {!payout && released && (
                <TouchableOpacity
                  style={[styles.btnPay, requesting === job.id && { opacity: 0.6 }]}
                  onPress={() => pedirPagamento(job)}
                  disabled={requesting === job.id}
                >
                  <Text style={styles.btnPayText}>
                    {requesting === job.id ? 'A solicitar...' : 'Solicitar pagamento'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F2D1A' },
  backBtn: { marginBottom: 12 },
  backBtnText: { color: '#F2C94C', fontWeight: '800', fontSize: 14 },
  title: { color: '#F5F0E8', fontSize: 26, fontWeight: '900', marginBottom: 6 },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 19, marginBottom: 18 },
  balanceCard: { backgroundColor: 'rgba(242,201,76,0.12)', borderWidth: 1.5, borderColor: '#F2C94C', borderRadius: 12, padding: 18, marginBottom: 22 },
  balanceLabel: { color: '#F2C94C', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  balanceValue: { color: '#F5F0E8', fontSize: 32, fontWeight: '900', marginVertical: 4 },
  accountBtn: { marginTop: 10, backgroundColor: '#F2C94C', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  accountBtnText: { color: '#1A1A2E', fontWeight: '900', fontSize: 13 },
  sectionTitle: { color: '#9CA3AF', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  empty: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginTop: 20 },
  jobCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 10 },
  jobTitle: { color: '#F5F0E8', fontWeight: '800', fontSize: 14 },
  jobDate: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  jobAmount: { color: '#F5F0E8', fontWeight: '900', fontSize: 16 },
  jobStatus: { fontSize: 11, fontWeight: '800', marginTop: 3 },
  btnPay: { width: '100%', backgroundColor: '#4ADE80', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  btnPayText: { color: '#0F2D1A', fontWeight: '900', fontSize: 13, textTransform: 'uppercase' },
})
