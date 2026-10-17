import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || ''

export default function ConfirmarServicoScreen() {
  const params = useLocalSearchParams<{ jobId: string }>()
  const [confirmado, setConfirmado] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jobStatus, setJobStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!params.jobId) return

    let timer: NodeJS.Timeout

    const carregarEstado = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('status')
        .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
        .maybeSingle()

      if (data?.status) setJobStatus(data.status)
    }

    carregarEstado()
    timer = setInterval(carregarEstado, 2500)

    return () => clearInterval(timer)
  }, [params.jobId])

  const handleConfirmar = async () => {
    Alert.alert(
      'Confirmar conclusão',
      'O serviço foi realizado a contento? O valor retido será libertado ao mestre.',
      [
        {
          text: 'Não, tenho um problema',
          style: 'destructive',
          onPress: () => router.push({ pathname: '/pedido/disputa', params: { jobId: params.jobId } })
        },
        {
          text: 'Sim, serviço concluído',
          onPress: async () => {
            try {
              setIsSubmitting(true)
              const res = await fetch(`${API_BASE}/api/payments/release`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: params.jobId })
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok || !data?.ok) {
                throw new Error(data?.error || 'Não foi possível libertar o pagamento.')
              }
              setConfirmado(true)
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Falha ao confirmar a conclusão.')
            } finally {
              setIsSubmitting(false)
            }
          }
        }
      ]
    )
  }

  if (confirmado || jobStatus === 'completed') {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>🏆</Text>
        <Text style={styles.successTitle}>Serviço concluído!</Text>
        <Text style={styles.successDesc}>
          O pagamento foi libertado ao mestre. Obrigado por usares o Bué de Mestres!
        </Text>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push({ pathname: '/avaliar', params: { jobId: params.jobId } })}
        >
          <Text style={styles.btnText}>⭐ Avaliar o mestre</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSkip} onPress={() => router.replace('/')}>
          <Text style={styles.btnSkipText}>Voltar ao Início</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const aguardandoMestre = jobStatus !== 'awaiting_confirmation'

  if (jobStatus === 'disputed') {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>🛡️</Text>
        <Text style={styles.successTitle}>Disputa em análise</Text>
        <Text style={styles.successDesc}>
          O pagamento continua retido enquanto a equipa de apoio analisa o caso. Vais receber novidades pelo sistema.
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace('/pedidos')}>
          <Text style={styles.btnText}>Ver Meus Pedidos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSkip} onPress={() => router.replace('/')}>
          <Text style={styles.btnSkipText}>Voltar ao Início</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Serviço em curso</Text>
        <Text style={styles.headerSub}>
          {aguardandoMestre
            ? 'Aguarda que o mestre marque o serviço como terminado'
            : 'Confirma quando o trabalho estiver terminado'}
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>{aguardandoMestre ? '⏳' : '🔒'}</Text>
        <View style={styles.infoText}>
          <Text style={styles.infoTitle}>
            {aguardandoMestre ? 'O mestre ainda está a trabalhar' : 'Pagamento retido'}
          </Text>
          <Text style={styles.infoDesc}>
            {aguardandoMestre
              ? 'Assim que o mestre concluir o serviço no sistema, esta tela actualiza sozinha e poderás verificar o trabalho.'
              : 'O valor está guardado e será libertado ao mestre assim que confirmares. Tens 24 horas para confirmar ou reportar um problema — depois disso, o pagamento é libertado automaticamente.'}
          </Text>
        </View>
      </View>

      {aguardandoMestre ? (
        <View style={styles.waitingBox}>
          <ActivityIndicator color="#1A1A2E" />
          <Text style={styles.waitingText}>À espera da confirmação do mestre...</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.btnConcluir, isSubmitting && { opacity: 0.6 }]}
          onPress={handleConfirmar}
          disabled={isSubmitting}
        >
          <Text style={styles.btnConcluirText}>
            {isSubmitting ? 'A libertar pagamento...' : '✓ Serviço concluído'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.btnProblema}
        onPress={() => router.push({ pathname: '/pedido/disputa', params: { jobId: params.jobId } })}
      >
        <Text style={styles.btnProblemaText}>⚠ Tive um problema</Text>
      </TouchableOpacity>
    </View>
  )
}

const TINTA = '#1A1A2E'
const PAPEL = '#F5F0E8'
const AMARELO = '#F2C94C'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPEL },
  header: { backgroundColor: TINTA, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20, marginBottom: 32 },
  headerTitle: { color: PAPEL, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  headerSub: { color: AMARELO, fontSize: 14, fontWeight: '600' },
  infoCard: { flexDirection: 'row', gap: 16, marginHorizontal: 20, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 20, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 40, alignItems: 'flex-start' },
  infoIcon: { fontSize: 28 },
  infoText: { flex: 1 },
  infoTitle: { fontWeight: '900', color: '#1E40AF', fontSize: 15, marginBottom: 6 },
  infoDesc: { fontSize: 13, color: '#1E40AF', lineHeight: 20, opacity: 0.8 },
  waitingBox: { marginHorizontal: 20, paddingVertical: 20, alignItems: 'center', gap: 10, marginBottom: 14 },
  waitingText: { color: '#6B7280', fontWeight: '700', fontSize: 13 },
  btnConcluir: { marginHorizontal: 20, backgroundColor: '#166534', borderRadius: 6, paddingVertical: 20, alignItems: 'center', borderWidth: 2, borderColor: '#4ADE80', marginBottom: 14 },
  btnConcluirText: { color: '#fff', fontWeight: '900', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
  btnProblema: { marginHorizontal: 20, paddingVertical: 18, borderRadius: 6, alignItems: 'center', borderWidth: 2, borderColor: '#EF4444', backgroundColor: 'transparent' },
  btnProblemaText: { color: '#EF4444', fontWeight: '800', fontSize: 15 },
  successContainer: { flex: 1, backgroundColor: '#0F2D1A', alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { fontSize: 72, marginBottom: 20 },
  successTitle: { fontSize: 28, fontWeight: '900', color: PAPEL, textAlign: 'center', marginBottom: 12 },
  successDesc: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  btnPrimary: { width: '100%', backgroundColor: AMARELO, borderRadius: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: '#fff', marginBottom: 14 },
  btnText: { color: TINTA, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
  btnSkip: { paddingVertical: 12 },
  btnSkipText: { color: 'rgba(255,255,255,0.45)', fontWeight: '600', fontSize: 14 },
})
