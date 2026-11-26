import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Linking } from 'react-native'
import { Alert } from '../lib/alertCompat'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'
import { validateAntiPhoneBypass } from '../lib/antiPhoneBypass'

const MOTIVOS = [
  { slug: 'pagamento', label: '💳 Pagamento ou carteira' },
  { slug: 'disputa', label: '⚠️ Problema com um trabalho' },
  { slug: 'conta', label: '👤 Conta e acesso' },
  { slug: 'tecnico', label: '🛠️ Erro na aplicação' },
]

export default function ProSuporteScreen() {
  const params = useLocalSearchParams<{ assunto?: string; descricao?: string }>()
  const user = useAuthStore((s) => s.user)
  const userId = user?.id || ''
  const [slug, setSlug] = useState('pagamento')
  const [descricao, setDescricao] = useState(params.descricao || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('tickets')
      .select('id, number, subject, status, created_at')
      .eq('requester_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setTickets(data || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [userId])

  const enviar = async () => {
    if (descricao.trim().length < 10) {
      Alert.alert('Descrição', 'Descreve o problema com pelo menos 10 caracteres.')
      return
    }
    const validation = validateAntiPhoneBypass(descricao)
    if (!validation.isValid) {
      Alert.alert('Aviso de Segurança', validation.errorMessage || 'Não é permitido partilhar contactos.')
      return
    }
    if (!userId) return

    try {
      setIsSubmitting(true)
      const { data: category } = await supabase
        .from('ticket_categories')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!category?.id) throw new Error('Categoria indisponível.')

      const subject = MOTIVOS.find((m) => m.slug === slug)?.label || 'Apoio ao mestre'
      const { data: number, error } = await supabase.rpc('create_ticket', {
        p_category: category.id,
        p_subject: subject,
        p_description: descricao.trim(),
      })
      if (error) throw error

      setDescricao('')
      await carregar()
      Alert.alert('Ticket criado', `Referência #${number}. Podes continuar a conversa no chat.`)
      if (number) router.push({ pathname: '/suporte-chat', params: { numero: String(number) } })
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível abrir o ticket.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Centro de Ajuda</Text>
        <Text style={styles.sub}>Fala com a equipa por mensagem ou pede uma chamada.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => Linking.openURL('tel:877981166')}
          activeOpacity={0.8}
        >
          <Text style={styles.callBtnText}>📞 Ligar para o apoio</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <TouchableOpacity style={styles.botBtn} onPress={() => router.push('/ajuda-bot')} activeOpacity={0.8}>
            <Text style={styles.botBtnText}>🤖 Resolver primeiro com o assistente</Text>
          </TouchableOpacity>
          <Text style={styles.cardTitle}>Abrir novo ticket</Text>
          {MOTIVOS.map((m) => (
            <TouchableOpacity
              key={m.slug}
              style={[styles.motivo, slug === m.slug && styles.motivoActive]}
              onPress={() => setSlug(m.slug)}
            >
              <Text style={[styles.motivoText, slug === m.slug && styles.motivoTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={styles.textarea}
            multiline
            placeholder="Descreve o que aconteceu..."
            placeholderTextColor="#94A3B8"
            value={descricao}
            onChangeText={setDescricao}
          />
          <TouchableOpacity style={styles.btn} onPress={enviar} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#0F2D1A" /> : <Text style={styles.btnText}>Submeter Ticket</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>OS MEUS TICKETS</Text>
        {loading ? (
          <ActivityIndicator color="#F2C94C" />
        ) : tickets.length === 0 ? (
          <Text style={styles.empty}>Ainda não tens tickets.</Text>
        ) : (
          tickets.map((ticket) => (
            <TouchableOpacity
              key={ticket.id}
              style={styles.ticketRow}
              onPress={() => router.push({ pathname: '/suporte-chat', params: { numero: String(ticket.number) } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.ticketNumber}>TKT-{ticket.number}</Text>
                <Text style={styles.ticketSubject}>{ticket.subject}</Text>
              </View>
              <Text style={styles.ticketStatus}>{ticket.status}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A' },
  header: { paddingTop: 48, paddingBottom: 18, paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.2)' },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#F2C94C', fontSize: 14, fontWeight: '800' },
  title: { color: '#F5F0E8', fontSize: 26, fontWeight: '900' },
  sub: { color: '#F2C94C', fontSize: 12, fontWeight: '600', marginTop: 2 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  callBtn: { backgroundColor: '#4ADE80', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  callBtnText: { color: '#0F2D1A', fontWeight: '900', fontSize: 14 },
  card: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  cardTitle: { color: '#F5F0E8', fontSize: 16, fontWeight: '900', marginBottom: 10 },
  botBtn: { backgroundColor: 'rgba(242,201,76,0.12)', borderWidth: 1, borderColor: '#F2C94C', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  botBtnText: { color: '#F2C94C', fontWeight: '900', fontSize: 12 },
  motivo: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, marginBottom: 6 },
  motivoActive: { backgroundColor: '#F2C94C' },
  motivoText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  motivoTextActive: { color: '#1A1A2E', fontWeight: '900' },
  textarea: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', color: '#F5F0E8', padding: 12, minHeight: 90, textAlignVertical: 'top', marginTop: 8 },
  btn: { marginTop: 12, backgroundColor: '#F2C94C', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#1A1A2E', fontWeight: '900', fontSize: 13 },
  sectionTitle: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 8 },
  empty: { color: '#94A3B8', fontSize: 13 },
  ticketRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  ticketNumber: { color: '#F2C94C', fontSize: 11, fontWeight: '900' },
  ticketSubject: { color: '#F5F0E8', fontSize: 13, fontWeight: '700' },
  ticketStatus: { color: '#94A3B8', fontSize: 10, textTransform: 'uppercase' },
})
