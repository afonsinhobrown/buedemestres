import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'

type Topic = {
  id: string
  title: string
  symptoms: string | null
  steps: string[]
  category_slug: string
}

export default function ProAjudaBotScreen() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [selected, setSelected] = useState<Topic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('support_bot_topics')
      .select('id, title, symptoms, steps, category_slug')
      .in('audience', ['both', 'provider'])
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setTopics((data as Topic[]) || [])
        setLoading(false)
      })
  }, [])

  const abrirTicket = () => {
    if (!selected) return
    router.push({
      pathname: '/suporte',
      params: {
        assunto: selected.title,
        descricao: `${selected.title}. ${selected.symptoms || ''} Já tentei os passos do bot.`,
      },
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🤖 Assistente de Ajuda</Text>
        <Text style={styles.sub}>Escolhe o problema e vê como resolver.</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2444C8" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {!selected ? (
            topics.map((topic) => (
              <TouchableOpacity key={topic.id} style={styles.topicCard} onPress={() => setSelected(topic)}>
                <Text style={styles.topicTitle}>{topic.title}</Text>
                {topic.symptoms ? <Text style={styles.topicSymptoms}>{topic.symptoms}</Text> : null}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.answerCard}>
              <Text style={styles.answerTitle}>{selected.title}</Text>
              {selected.symptoms ? <Text style={styles.answerSymptoms}>{selected.symptoms}</Text> : null}
              {(selected.steps || []).map((step, index) => (
                <View key={index} style={styles.stepRow}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.ticketBtn} onPress={abrirTicket}>
                <Text style={styles.ticketBtnText}>Não resolveu? Abrir ticket</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backLink} onPress={() => setSelected(null)}>
                <Text style={styles.backLinkText}>Ver outros problemas</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDF0F2' },
  header: { backgroundColor: '#12163A', paddingTop: 48, paddingBottom: 18, paddingHorizontal: 20 },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#FFC61A', fontSize: 14, fontWeight: '800' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  sub: { color: '#FFC61A', fontSize: 12, fontWeight: '600', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  topicCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  topicTitle: { color: '#12163A', fontWeight: '900', fontSize: 14 },
  topicSymptoms: { color: '#6B7280', fontSize: 12, marginTop: 4 },
  answerCard: { backgroundColor: '#fff', borderRadius: 12, padding: 18, borderWidth: 2, borderColor: '#12163A' },
  answerTitle: { color: '#12163A', fontSize: 20, fontWeight: '900', marginBottom: 4 },
  answerSymptoms: { color: '#6B7280', fontSize: 13, marginBottom: 14 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#2444C8', color: '#fff', textAlign: 'center', fontWeight: '900', lineHeight: 24 },
  stepText: { flex: 1, color: '#374151', fontSize: 13, lineHeight: 19 },
  ticketBtn: { marginTop: 10, backgroundColor: '#FFC61A', borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: '#12163A' },
  ticketBtnText: { color: '#12163A', fontWeight: '900', fontSize: 14 },
  backLink: { marginTop: 12, alignItems: 'center' },
  backLinkText: { color: '#2444C8', fontWeight: '800', fontSize: 13 },
})
