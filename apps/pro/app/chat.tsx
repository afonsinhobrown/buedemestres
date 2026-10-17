import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  } from 'react-native'
import { Alert } from '../lib/alertCompat'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'
import { validateAntiPhoneBypass } from '../lib/antiPhoneBypass'

type Message = {
  id: string
  sender_id: string
  body: string | null
  created_at: string
}

export default function ProChatScreen() {
  const params = useLocalSearchParams<{ jobId?: string; requestId?: string }>()
  const jobId = params.jobId || params.requestId || ''
  const user = useAuthStore((s) => s.user)
  const userId = user?.id || ''

  const [loading, setLoading] = useState(true)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (!jobId || !userId) {
      setLoading(false)
      return
    }

    let channel: ReturnType<typeof supabase.channel> | null = null

    const carregar = async () => {
      const { data: job } = await supabase
        .from('jobs')
        .select('id, request_id, client_id, provider_id')
        .or(`id.eq.${jobId},request_id.eq.${jobId}`)
        .maybeSingle()

      if (!job) {
        Alert.alert('Erro', 'Trabalho não encontrado para conversa.')
        setLoading(false)
        return
      }

      const { data: conversation, error } = await supabase
        .from('conversations')
        .upsert(
          {
            client_id: job.client_id,
            provider_id: job.provider_id,
            request_id: job.request_id,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: 'client_id,provider_id,request_id' }
        )
        .select('id')
        .single()

      if (error || !conversation) {
        Alert.alert('Erro', 'Não foi possível abrir a conversa.')
        setLoading(false)
        return
      }

      setConversationId(conversation.id)

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })

      setMessages((msgs as Message[]) || [])
      setLoading(false)

      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .neq('sender_id', userId)
        .is('read_at', null)

      channel = supabase
        .channel(`pro_chat_${conversation.id}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversation.id}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message])
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
          }
        )
        .subscribe()
    }

    carregar()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [jobId, userId])

  const enviar = async () => {
    const body = texto.trim()
    if (!body || !conversationId || !userId) return

    const validation = validateAntiPhoneBypass(body)
    if (!validation.isValid) {
      Alert.alert('Aviso de Segurança', validation.errorMessage || 'Não é permitido partilhar contactos.')
      return
    }

    try {
      setSending(true)
      setTexto('')
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        body,
      })
      if (error) throw error
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    } catch (err: any) {
      setTexto(body)
      Alert.alert('Erro', err.message || 'Não foi possível enviar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mensagens</Text>
        <Text style={styles.headerSub}>Conversa segura com o cliente</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F2C94C" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <Text style={styles.empty}>Ainda não há mensagens. Escreve a primeira.</Text>
          ) : (
            messages.map((message) => {
              const mine = message.sender_id === userId
              return (
                <View key={message.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
                  <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                    {new Date(message.created_at).toLocaleTimeString('pt-MZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escreve uma mensagem..."
          placeholderTextColor="#94A3B8"
          value={texto}
          onChangeText={setTexto}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!texto.trim() || sending) && { opacity: 0.5 }]}
          onPress={enviar}
          disabled={!texto.trim() || sending}
        >
          <Text style={styles.sendBtnText}>{sending ? '...' : 'Enviar'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A' },
  header: { paddingTop: 48, paddingBottom: 18, paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.2)' },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#F2C94C', fontSize: 14, fontWeight: '800' },
  headerTitle: { color: '#F5F0E8', fontSize: 24, fontWeight: '900' },
  headerSub: { color: '#F2C94C', fontSize: 12, fontWeight: '600', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 10 },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40, fontSize: 14 },
  bubble: { maxWidth: '82%', borderRadius: 12, padding: 12 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#F2C94C' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  bubbleText: { fontSize: 14, color: '#F5F0E8', lineHeight: 20 },
  bubbleTextMine: { color: '#1A1A2E' },
  bubbleTime: { fontSize: 10, color: '#94A3B8', marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: '#78350F' },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: 'rgba(0,0,0,0.25)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#F5F0E8' },
  sendBtn: { backgroundColor: '#4ADE80', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnText: { color: '#0F2D1A', fontWeight: '900', fontSize: 13 },
})
