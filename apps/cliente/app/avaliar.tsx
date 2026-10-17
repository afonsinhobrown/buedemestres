import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/useAuthStore'

const TAGS = [
  '⏱️ Pontual',
  '💰 Preço Justo',
  '🛠️ Trabalho Limpo',
  '⚡ Rápido e Eficiente',
  '🤝 Muito Profissional'
]

export default function AvaliarMestreScreen() {
  const params = useLocalSearchParams<{ jobId: string }>()
  const user = useAuthStore((s) => s.user)
  const [rating, setRating] = useState<number>(5)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comentario, setComentario] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [concluido, setConcluido] = useState(false)

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmeter = async () => {
    if (!params.jobId) {
      Alert.alert('Erro', 'Identificador do serviço não encontrado.')
      return
    }

    setSubmitting(true)
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id, provider_id, client_id, status')
        .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
        .maybeSingle()

      if (jobError || !jobData) {
        Alert.alert('Erro', 'Trabalho não encontrado para avaliação.')
        return
      }
      if (jobData.status !== 'completed') {
        Alert.alert('Ainda não é possível avaliar', 'A avaliação só fica disponível depois da confirmação da conclusão.')
        return
      }

      const fullComment = selectedTags.length > 0 
        ? `${selectedTags.join(', ')}. ${comentario}`.trim()
        : comentario.trim()

      const clientId = user?.id || jobData.client_id
      const providerId = jobData.provider_id

      const { error } = await supabase.from('reviews').insert({
        job_id: jobData.id,
        client_id: clientId,
        provider_id: providerId,
        rating: rating,
        comment: fullComment || null
      })

      if (error) {
        if (error.message?.includes('duplicate') || error.code === '23505') {
          Alert.alert('Já avaliaste', 'Já existe uma avaliação para este trabalho.')
          setConcluido(true)
          return
        }
        throw new Error(error.message)
      }

      setConcluido(true)
    } catch (err: any) {
      console.error('Erro na avaliação:', err)
      Alert.alert('Erro', err.message || 'Não foi possível guardar a avaliação.')
    } finally {
      setSubmitting(false)
    }
  }

  if (concluido) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>🌟</Text>
        <Text style={styles.successTitle}>Obrigado pela avaliação!</Text>
        <Text style={styles.successDesc}>
          O teu feedback ajuda a manter a comunidade do Bué de Mestres de confiança e com qualidade garantida.
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace('/')}>
          <Text style={styles.btnText}>Voltar ao Início</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Como correu o serviço?</Text>
        <Text style={styles.headerSub}>A tua avaliação é essencial para o Mestre e para a comunidade</Text>
      </View>

      {/* Estrelas */}
      <View style={styles.starsCard}>
        <Text style={styles.starsLabel}>CLASSIFICAÇÃO GERAL</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
              <Text style={[styles.starEmoji, rating >= star ? styles.starFilled : styles.starEmpty]}>
                ⭐
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingText}>
          {rating === 5 && 'Excepcional! Muito recomendado'}
          {rating === 4 && 'Muito bom, serviço de qualidade'}
          {rating === 3 && 'Razoável, cumpriu o pedido'}
          {rating === 2 && 'Abaixo do esperado'}
          {rating === 1 && 'Insatisfatório'}
        </Text>
      </View>

      {/* Tags de Destaque */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>O QUE MAIS SE DESTACOU?</Text>
        <View style={styles.tagsContainer}>
          {TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag)
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, isSelected && styles.tagSelected]}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Comentário Livre */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DEIXA UM COMENTÁRIO (OPCIONAL)</Text>
        <TextInput
          style={styles.textarea}
          placeholder="Descreve como foi a experiência com o mestre..."
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          value={comentario}
          onChangeText={setComentario}
          maxLength={300}
        />
        <Text style={styles.charCount}>{comentario.length}/300</Text>
      </View>

      {/* Botões de Ação */}
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={handleSubmeter}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#1A1A2E" />
        ) : (
          <Text style={styles.btnText}>Submeter Avaliação</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnSkip}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.btnSkipText}>Saltar por agora</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const TINTA = '#1A1A2E'
const PAPEL = '#F5F0E8'
const AMARELO = '#F2C94C'
const ZINCO = '#6B7280'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPEL },
  content: { paddingBottom: 40 },
  header: { backgroundColor: TINTA, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20, marginBottom: 20 },
  headerTitle: { color: PAPEL, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
  headerSub: { color: AMARELO, fontSize: 13, fontWeight: '600' },
  starsCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 10, padding: 22, alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB', marginBottom: 20 },
  starsLabel: { fontSize: 11, fontWeight: '800', color: ZINCO, letterSpacing: 1.5, marginBottom: 12 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  starEmoji: { fontSize: 38 },
  starFilled: { opacity: 1 },
  starEmpty: { opacity: 0.25 },
  ratingText: { fontSize: 14, fontWeight: '700', color: TINTA },
  section: { marginHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: ZINCO, letterSpacing: 1.2, marginBottom: 10 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#D1D5DB' },
  tagSelected: { backgroundColor: TINTA, borderColor: TINTA },
  tagText: { color: TINTA, fontSize: 13, fontWeight: '700' },
  tagTextSelected: { color: AMARELO },
  textarea: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 2, borderColor: '#E5E7EB', padding: 14, fontSize: 14, color: TINTA, minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: ZINCO, textAlign: 'right', marginTop: 4 },
  btnPrimary: { marginHorizontal: 20, backgroundColor: AMARELO, borderRadius: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: TINTA, marginBottom: 12 },
  btnText: { color: TINTA, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
  btnSkip: { marginHorizontal: 20, paddingVertical: 12, alignItems: 'center' },
  btnSkipText: { color: ZINCO, fontWeight: '600', fontSize: 14 },
  successContainer: { flex: 1, backgroundColor: '#0F2D1A', alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { fontSize: 72, marginBottom: 20 },
  successTitle: { fontSize: 26, fontWeight: '900', color: PAPEL, textAlign: 'center', marginBottom: 12 },
  successDesc: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: 36 },
})
