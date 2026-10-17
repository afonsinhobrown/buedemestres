import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState } from 'react'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || ''

const MOTIVOS = [
  'O trabalho não ficou como combinado',
  'O mestre não concluiu o serviço',
  'Danos causados durante o serviço',
  'Cobrança diferente do valor acordado',
  'Outro problema'
]

export default function DisputaScreen() {
  const params = useLocalSearchParams<{ jobId: string }>()
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [detalhes, setDetalhes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ticket, setTicket] = useState<string | null>(null)

  const handleSubmeter = async () => {
    if (!params.jobId) {
      Alert.alert('Erro', 'Trabalho não identificado.')
      return
    }
    if (detalhes.trim().length < 10) {
      Alert.alert('Detalhes em falta', 'Descreve o problema com pelo menos 10 caracteres.')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await fetch(`${API_BASE}/api/payments/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: params.jobId,
          reason: `${motivo}. ${detalhes.trim()}`
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Não foi possível abrir a disputa.')
      }
      setTicket(data.ticket ? String(data.ticket) : 'registada')
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao abrir a disputa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (ticket) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>🛡️</Text>
        <Text style={styles.successTitle}>Disputa registada</Text>
        <Text style={styles.successDesc}>
          O pagamento ficou retido enquanto a equipa de apoio analisa o caso. Vais receber novidades pelo sistema.
        </Text>
        <View style={styles.ticketBox}>
          <Text style={styles.ticketLabel}>REFERÊNCIA DO TICKET</Text>
          <Text style={styles.ticketValue}>#{ticket}</Text>
        </View>
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tive um problema</Text>
        <Text style={styles.headerSub}>
          O valor continua retido até a situação ser resolvida pela equipa de apoio.
        </Text>
      </View>

      <Text style={styles.label}>O que aconteceu?</Text>
      {MOTIVOS.map((m) => (
        <TouchableOpacity
          key={m}
          style={[styles.motivoItem, motivo === m && styles.motivoItemActive]}
          onPress={() => setMotivo(m)}
          activeOpacity={0.7}
        >
          <View style={[styles.radio, motivo === m && styles.radioActive]}>
            {motivo === m && <View style={styles.radioDot} />}
          </View>
          <Text style={[styles.motivoText, motivo === m && styles.motivoTextActive]}>{m}</Text>
        </TouchableOpacity>
      ))}

      <Text style={[styles.label, { marginTop: 18 }]}>Descreve os detalhes</Text>
      <TextInput
        style={styles.textarea}
        multiline
        numberOfLines={5}
        placeholder="Explica o que correu mal para a equipa poder mediar..."
        placeholderTextColor="#9CA3AF"
        value={detalhes}
        onChangeText={setDetalhes}
        maxLength={1000}
      />

      <TouchableOpacity
        style={[styles.btnDanger, isSubmitting && { opacity: 0.6 }]}
        onPress={handleSubmeter}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnDangerText}>Abrir Disputa e Reter Pagamento</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSkip} onPress={() => router.back()}>
        <Text style={styles.btnSkipText}>Cancelar</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const TINTA = '#1A1A2E'
const PAPEL = '#F5F0E8'
const AMARELO = '#F2C94C'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPEL },
  content: { paddingBottom: 40 },
  header: { backgroundColor: TINTA, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20, marginBottom: 20 },
  headerTitle: { color: PAPEL, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
  headerSub: { color: AMARELO, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '800', color: TINTA, marginHorizontal: 20, marginBottom: 10 },
  motivoItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1.5, borderColor: '#E5E7EB' },
  motivoItemActive: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#9CA3AF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  radioActive: { borderColor: '#EF4444' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  motivoText: { fontSize: 13, color: '#374151', fontWeight: '700', flex: 1 },
  motivoTextActive: { color: '#991B1B', fontWeight: '900' },
  textarea: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1.5, borderColor: '#D1D5DB', padding: 12, fontSize: 14, color: TINTA, minHeight: 120, textAlignVertical: 'top' },
  btnDanger: { marginHorizontal: 20, marginTop: 22, backgroundColor: '#DC2626', borderRadius: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: '#991B1B' },
  btnDangerText: { color: '#fff', fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnSkip: { paddingVertical: 14, alignItems: 'center' },
  btnSkipText: { color: '#6B7280', fontWeight: '700', fontSize: 14 },
  successContainer: { flex: 1, backgroundColor: '#0F2D1A', alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 26, fontWeight: '900', color: PAPEL, textAlign: 'center', marginBottom: 12 },
  successDesc: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  ticketBox: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 18, alignItems: 'center', marginBottom: 28, width: '100%', borderWidth: 1, borderColor: '#F2C94C' },
  ticketLabel: { color: '#F2C94C', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  ticketValue: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 4 },
  btnPrimary: { width: '100%', backgroundColor: AMARELO, borderRadius: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: '#fff', marginBottom: 14 },
  btnText: { color: TINTA, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
})
