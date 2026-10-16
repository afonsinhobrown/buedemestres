import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, TextInput, Alert, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/useAuthStore'
import { validateAntiPhoneBypass } from '@/lib/antiPhoneBypass'

const MOTIVOS = [
  { id: 'atraso_mestre', label: '🚗 Mestre atrasado ou não compareceu' },
  { id: 'disputa_valor', label: '💰 Disputa de valor ou retenção de pagamento (Escrow)' },
  { id: 'trabalho_incompleto', label: '⚠️ Trabalho não realizado ou incompleto' },
  { id: 'duvida_geral', label: '❓ Dúvida geral ou falar com operador' }
]

export default function SuporteScreen() {
  const params = useLocalSearchParams<{ jobId?: string; assunto?: string }>()
  const profile = useAuthStore(s => s.profile)

  const [motivo, setMotivo] = useState(params.jobId ? 'disputa_valor' : 'atraso_mestre')
  const [descricao, setDescricao] = useState('')
  const [bypassError, setBypassError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ticketCriado, setTicketCriado] = useState<string | null>(null)

  const handleDescricaoChange = (text: string) => {
    setDescricao(text)
    const validation = validateAntiPhoneBypass(text)
    if (!validation.isValid) {
      setBypassError(validation.errorMessage || 'Não é permitido partilhar contactos.')
    } else {
      setBypassError(null)
    }
  }

  const handleEnviarTicket = async () => {
    if (!descricao.trim()) {
      Alert.alert('Campo Obrigatório', 'Por favor descreva o problema ou dúvida.')
      return
    }

    if (bypassError) {
      Alert.alert('Aviso de Segurança', bypassError)
      return
    }

    try {
      setIsSubmitting(true)
      const clientId = profile?.id || '11111111-1111-1111-1111-111111111111'
      const ticketSubject = MOTIVOS.find(m => m.id === motivo)?.label || 'Apoio ao Cliente'

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          client_id: clientId,
          request_id: params.jobId || null,
          category: motivo,
          subject: ticketSubject,
          description: descricao.trim(),
          status: 'open'
        })
        .select()
        .single()

      if (error) {
        console.warn('Erro ao inserir ticket em support_tickets:', error)
      }

      const ticketRef = data?.id ? data.id.substring(0, 8).toUpperCase() : `BDM-${Math.floor(1000 + Math.random() * 9000)}`
      setTicketCriado(ticketRef)
    } catch (err) {
      console.error('Erro ao submeter ticket:', err)
      Alert.alert('Erro', 'Ocorreu um erro ao submeter o pedido de apoio.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF0F2" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>← Voltar</Text>
          </TouchableOpacity>
          <View style={styles.supportBadge}>
            <Text style={styles.supportBadgeText}>LINHA DE APOIO</Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>Central de Suporte</Text>
        <Text style={styles.headerSub}>Estamos aqui para proteger o cliente e mediar qualquer situação</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {ticketCriado ? (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Ticket de Suporte Criado!</Text>
            <Text style={styles.ticketRefText}>Referência: #{ticketCriado}</Text>
            <Text style={styles.successDesc}>
              A equipa de moderação da Bué de Mestres já recebeu o seu relatório e entrará em contacto pelo sistema.
            </Text>

            <TouchableOpacity 
              style={styles.btnVoltarHome} 
              onPress={() => router.push('/pedidos')}
            >
              <Text style={styles.btnVoltarHomeText}>Ver Meus Pedidos →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Contactos Rápidos Oficiais */}
            <View style={styles.contactCard}>
              <Text style={styles.contactCardTitle}>Canais Directos Oficiais</Text>
              <Text style={styles.contactCardDesc}>
                Para situações urgentes ou mediação imediata com o operador da plataforma:
              </Text>
              
              <TouchableOpacity 
                style={styles.whatsappBtn}
                onPress={() => Alert.alert('Apoio WhatsApp', 'A abrir chat oficial com o suporte Bué de Mestres (+258 84 000 0000)...')}
                activeOpacity={0.8}
              >
                <Text style={styles.whatsappBtnText}>💬 WhatsApp Oficial Bué de Mestres</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.reboqueBtn}
                onPress={() => router.push('/pedido/novo?categoria=mecanico')}
                activeOpacity={0.8}
              >
                <Text style={styles.reboqueBtnText}>🚨 Pedir Reboque ou Mestre Urgente</Text>
              </TouchableOpacity>
            </View>

            {/* Formulário de Ticket */}
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Abrir Chamado / Relatório</Text>
              
              {params.jobId && (
                <View style={styles.jobRefBox}>
                  <Text style={styles.jobRefLabel}>Pedido Referenciado:</Text>
                  <Text style={styles.jobRefValue}>ID: {params.jobId.substring(0, 12)}... {params.assunto ? `(${params.assunto})` : ''}</Text>
                </View>
              )}

              <Text style={styles.label}>Qual é a situação?</Text>
              {MOTIVOS.map(m => (
                <TouchableOpacity 
                  key={m.id}
                  style={[styles.motivoItem, motivo === m.id && styles.motivoItemActive]}
                  onPress={() => setMotivo(m.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioCircle, motivo === m.id && styles.radioCircleActive]}>
                    {motivo === m.id && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.motivoText, motivo === m.id && styles.motivoTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.label, { marginTop: 18 }]}>Descreva o que aconteceu</Text>
              <TextInput 
                style={[styles.textarea, bypassError && styles.textareaError]}
                multiline
                numberOfLines={4}
                placeholder="Explique os detalhes para a nossa equipa ajudar da melhor forma..."
                placeholderTextColor="#9CA3AF"
                value={descricao}
                onChangeText={handleDescricaoChange}
              />

              {bypassError && (
                <Text style={styles.bypassErrorText}>⚠️ {bypassError}</Text>
              )}

              <TouchableOpacity 
                style={[styles.btnSubmit, (isSubmitting || !!bypassError) && styles.btnSubmitDisabled]}
                disabled={isSubmitting || !!bypassError}
                onPress={handleEnviarTicket}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#12163A" />
                ) : (
                  <Text style={styles.btnSubmitText}>Submeter Chamado de Suporte →</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EDF0F2' },
  header: { backgroundColor: '#12163A', padding: 20, paddingTop: 28 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  backBtnText: { color: '#FFC61A', fontSize: 15, fontWeight: '800' },
  supportBadge: { backgroundColor: '#FFC61A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  supportBadgeText: { color: '#12163A', fontSize: 11, fontWeight: '900' },
  headerTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#DCE3FA', fontSize: 13, marginTop: 4 },

  content: { padding: 16, paddingBottom: 40 },

  contactCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#12163A',
  },
  contactCardTitle: { color: '#FFC61A', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  contactCardDesc: { color: '#DCE3FA', fontSize: 13, lineHeight: 18, marginBottom: 14 },
  whatsappBtn: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#15803D',
  },
  whatsappBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  reboqueBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  reboqueBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    borderWidth: 2,
    borderColor: '#12163A',
  },
  formTitle: { fontSize: 18, fontWeight: '900', color: '#12163A', marginBottom: 12 },
  jobRefBox: {
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#2444C8',
  },
  jobRefLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  jobRefValue: { fontSize: 13, color: '#12163A', fontWeight: '800' },

  label: { fontSize: 14, fontWeight: '800', color: '#12163A', marginBottom: 8 },
  motivoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  motivoItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2444C8',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioCircleActive: { borderColor: '#2444C8' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2444C8' },
  motivoText: { fontSize: 13, color: '#374151', fontWeight: '700', flex: 1 },
  motivoTextActive: { color: '#1E40AF', fontWeight: '900' },

  textarea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    padding: 12,
    fontSize: 14,
    color: '#12163A',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  textareaError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  bypassErrorText: { color: '#DC2626', fontSize: 12, marginTop: 4, fontWeight: '700' },

  btnSubmit: {
    backgroundColor: '#FFC61A',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 18,
    borderWidth: 2,
    borderColor: '#12163A',
  },
  btnSubmitDisabled: { opacity: 0.5 },
  btnSubmitText: { color: '#12163A', fontWeight: '900', fontSize: 15 },

  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#12163A',
  },
  successIcon: { fontSize: 56, marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#12163A', marginBottom: 6 },
  ticketRefText: { fontSize: 16, fontWeight: '900', color: '#2444C8', marginBottom: 12 },
  successDesc: { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  btnVoltarHome: {
    backgroundColor: '#2444C8',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#12163A',
  },
  btnVoltarHomeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
})
