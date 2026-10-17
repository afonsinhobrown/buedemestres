import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || ''

export default function ReportarMestreScreen() {
  const params = useLocalSearchParams<{ jobId?: string }>()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ticket, setTicket] = useState<string | null>(null)

  const enviar = async () => {
    if (reason.trim().length < 10) {
      Alert.alert('Descrição', 'Explica a situação com pelo menos 10 caracteres.')
      return
    }
    try {
      setSubmitting(true)
      const res = await fetch(`${API_BASE}/api/reports/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: params.jobId, reason: reason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível reportar.')
      setTicket(data.ticket ? String(data.ticket) : 'registado')
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao reportar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (ticket) {
    return (
      <View style={styles.success}>
        <Text style={styles.successIcon}>🛡️</Text>
        <Text style={styles.successTitle}>Reporte registado</Text>
        <Text style={styles.successText}>
          A equipa de apoio vai analisar a situação e aplicar as penalizações previstas.
        </Text>
        <Text style={styles.successTicket}>Ticket #{ticket}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/')}>
          <Text style={styles.btnText}>Voltar ao Início</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reportar mestre diferente</Text>
        <Text style={styles.sub}>
          Se quem chegou ao local não é o mestre atribuído, reporta. A substituição não autorizada é punível.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>O que aconteceu?</Text>
        <TextInput
          style={styles.textarea}
          multiline
          numberOfLines={5}
          value={reason}
          onChangeText={setReason}
          placeholder="Descreve o mestre que apareceu, horário e qualquer detalhe relevante..."
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity style={[styles.btn, submitting && { opacity: 0.6 }]} onPress={enviar} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#12163A" /> : <Text style={styles.btnText}>Enviar Reporte</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDF0F2' },
  header: { backgroundColor: '#12163A', paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#FFC61A', fontSize: 14, fontWeight: '800' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  sub: { color: '#FFC61A', fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 17 },
  card: { margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 2, borderColor: '#12163A' },
  label: { color: '#12163A', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  textarea: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1.5, borderColor: '#D1D5DB', padding: 12, fontSize: 14, color: '#12163A', minHeight: 120, textAlignVertical: 'top' },
  btn: { marginTop: 16, backgroundColor: '#FFC61A', borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: '#12163A' },
  btnText: { color: '#12163A', fontWeight: '900', fontSize: 14 },
  success: { flex: 1, backgroundColor: '#0F2D1A', alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { fontSize: 60, marginBottom: 16 },
  successTitle: { color: '#F5F0E8', fontSize: 24, fontWeight: '900', marginBottom: 10 },
  successText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 18 },
  successTicket: { color: '#F2C94C', fontSize: 18, fontWeight: '900', marginBottom: 24 },
})
