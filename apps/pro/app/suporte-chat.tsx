import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Linking } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

type TicketMessage = { id: string; author_id: string; body: string; created_at: string; is_internal: boolean }

export default function ProSuporteChatScreen() {
  const params = useLocalSearchParams<{ numero?: string }>()
  const numero = params.numero || ''
  const user = useAuthStore((s) => s.user)
  const userId = user?.id || ''
  const [loading, setLoading] = useState(true)
  const [ticket, setTicket] = useState<any>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (!numero || !userId) {
      setLoading(false)
      return
    }
    let channel: ReturnType<typeof supabase.channel> | null = null

    const carregar = async () => {
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('id, number, subject, status, requester_id')
        .eq('number', numero)
        .maybeSingle()

      if (!ticketData || ticketData.requester_id !== userId) {
        setLoading(false)
        return
      }
      setTicket(ticketData)

      const { data: msgs } = await supabase
        .from('ticket_messages')
        .select('id, author_id, body, created_at, is_internal')
        .eq('ticket_id', ticketData.id)
        .eq('is_internal', false)
        .order('created_at', { ascending: true })
      setMessages((msgs as TicketMessage[]) || [])
      setLoading(false)

      channel = supabase
        .channel(`ticket_${ticketData.id}_${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketData.id}` },
          (payload) => {
            const row = payload.new as TicketMessage
            if (!row.is_internal) setMessages((prev) => [...prev, row])
          }
        )
        .subscribe()
    }
    carregar()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [numero, userId])

  const enviar = async () => {
    const body = texto.trim()
    if (!body || !ticket || !userId) return
    try {
      setSending(true)
      setTexto('')
      const { error } = await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        author_id: userId,
        body,
      })
      if (error) throw error
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    } catch (err: any) {
      setTexto(body)
      Alert.alert('Erro', err.message || 'Não foi possível enviar.')
    } finally {
      setSending(false)
    }
  }

  if (!loading && !ticket) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Ticket não encontrado.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={styles.link}>Voltar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{ticket ? `TKT-${ticket.number}` : 'Suporte'}</Text>
        <Text style={styles.sub}>{ticket?.subject || 'Conversa com o centro de ajuda'}</Text>
        <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL('tel:+258840000000')}>
          <Text style={styles.callBtnText}>📞 Pedir chamada</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2444C8" />
        </View>
      ) : (
        <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {messages.length === 0 ? (
            <Text style={styles.empty}>Ainda não há mensagens neste ticket.</Text>
          ) : (
            messages.map((message) => {
              const mine = message.author_id === userId
              return (
                <View key={message.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
                  <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                    {new Date(message.created_at).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="Escreve para o apoio..." placeholderTextColor="#9CA3AF" value={texto} onChangeText={setTexto} multiline />
        <TouchableOpacity style={[styles.sendBtn, (!texto.trim() || sending) && { opacity: 0.5 }]} onPress={enviar} disabled={!texto.trim() || sending}>
          <Text style={styles.sendBtnText}>{sending ? '...' : 'Enviar'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDF0F2' },
  header: { backgroundColor: '#12163A', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#FFC61A', fontSize: 14, fontWeight: '800' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  sub: { color: '#FFC61A', fontSize: 12, fontWeight: '600', marginTop: 2 },
  callBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#22C55E', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  callBtnText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 10 },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
  bubble: { maxWidth: '82%', borderRadius: 12, padding: 12 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#2444C8' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  bubbleText: { fontSize: 14, color: '#12163A', lineHeight: 20 },
  bubbleTextMine: { color: '#FFFFFF' },
  bubbleTime: { fontSize: 10, color: '#6B7280', marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: '#DBEAFE' },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#12163A' },
  sendBtn: { backgroundColor: '#2444C8', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', borderWidth: 1.5, borderColor: '#12163A' },
  sendBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  link: { color: '#2444C8', fontWeight: '800' },
})
