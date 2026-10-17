import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function TermosScreen() {
  const [loading, setLoading] = useState(true)
  const [terms, setTerms] = useState<{ title: string; content: string; version: string } | null>(null)

  useEffect(() => {
    supabase
      .from('terms_versions')
      .select('title, content, version')
      .eq('audience', 'client')
      .eq('is_current', true)
      .maybeSingle()
      .then(({ data }) => {
        setTerms(data || null)
        setLoading(false)
      })
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{terms?.title || 'Termos e Condições'}</Text>
        <Text style={styles.sub}>Versão {terms?.version || '1.0'}</Text>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2444C8" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.body}>{terms?.content || 'Termos indisponíveis.'}</Text>
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
  content: { padding: 20, paddingBottom: 40 },
  body: { color: '#374151', fontSize: 14, lineHeight: 22 },
})
