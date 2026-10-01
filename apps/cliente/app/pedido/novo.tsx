import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import * as Location from 'expo-location'

// Categorias disponíveis para pedido imediato (on-demand)
const CATEGORIAS_IMEDIATAS = [
  { id: 1, emoji: '🔧', nome: 'Mecânico', desc: 'Avaria, motor, pneus' },
  { id: 2, emoji: '⚡', nome: 'Electricista', desc: 'Instalações, avarias' },
  { id: 3, emoji: '🚿', nome: 'Canalizador', desc: 'Fugas, entupimentos' },
  { id: 4, emoji: '🔑', nome: 'Chaveiro', desc: 'Fechaduras, cópias' },
  { id: 5, emoji: '🚗', nome: 'Reboque', desc: 'Socorro na estrada' },
  { id: 6, emoji: '🔌', nome: 'Técnico TV/Sat', desc: 'TV, antenas, decodificadores' },
]

export default function NovoPedidoImediatoScreen() {
  const [step, setStep] = useState<'categoria' | 'descricao' | 'localizacao'>('categoria')
  const [categoria, setCategoria] = useState<typeof CATEGORIAS_IMEDIATAS[0] | null>(null)
  const [descricao, setDescricao] = useState('')
  const [referencia, setReferencia] = useState('')
  const [location, setLocation] = useState<Location.LocationObject | null>(null)
  const [isLocating, setIsLocating] = useState(false)

  const handleCategoria = (cat: typeof CATEGORIAS_IMEDIATAS[0]) => {
    setCategoria(cat)
    setStep('descricao')
  }

  const handleLocalizacao = async () => {
    setIsLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos da localização para enviar o teu pedido ao mestre mais próximo.')
        setIsLocating(false)
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setLocation(loc)
      setStep('localizacao')
    } catch {
      Alert.alert('Erro', 'Não conseguimos obter a tua localização. Verifica o GPS.')
    }
    setIsLocating(false)
  }

  const handleEnviar = () => {
    if (!categoria || !location) return
    // Navegar para o ecrã de "A procurar mestre"
    router.push({
      pathname: '/pedido/a-procurar',
      params: {
        categoriaId: categoria.id.toString(),
        categoriaNome: categoria.nome,
        descricao,
        referencia,
        lat: location.coords.latitude.toString(),
        lng: location.coords.longitude.toString(),
      }
    })
  }

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 'categoria' ? router.back() : setStep(step === 'localizacao' ? 'descricao' : 'categoria')} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'categoria' ? 'Que tipo de mestre?' :
           step === 'descricao' ? `${categoria?.emoji} ${categoria?.nome}` :
           'A tua localização'}
        </Text>
        <View style={styles.stepDots}>
          {['categoria', 'descricao', 'localizacao'].map((s, i) => (
            <View key={s} style={[styles.dot, step === s && styles.dotActive, i < ['categoria', 'descricao', 'localizacao'].indexOf(step) && styles.dotDone]} />
          ))}
        </View>
      </View>

      {/* PASSO 1: Categoria */}
      {step === 'categoria' && (
        <ScrollView contentContainerStyle={styles.categorias}>
          <Text style={styles.sectionLabel}>SERVIÇO IMEDIATO — URGÊNCIA</Text>
          {CATEGORIAS_IMEDIATAS.map(cat => (
            <TouchableOpacity key={cat.id} style={styles.catCard} onPress={() => handleCategoria(cat)} activeOpacity={0.7}>
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <View style={styles.catInfo}>
                <Text style={styles.catNome}>{cat.nome}</Text>
                <Text style={styles.catDesc}>{cat.desc}</Text>
              </View>
              <Text style={styles.catArrow}>→</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.btnOutline} onPress={() => router.push('/pedido/orcamento')}>
            <Text style={styles.btnOutlineText}>Prefiro pedir orçamentos →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* PASSO 2: Descrição */}
      {step === 'descricao' && (
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>Descreve o problema</Text>
          <TextInput
            style={styles.textarea}
            placeholder={`Ex: O motor do meu carro não arranca. Bateria em dia.`}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={descricao}
            onChangeText={setDescricao}
            maxLength={300}
          />
          <Text style={styles.charCount}>{descricao.length}/300</Text>

          <Text style={[styles.label, { marginTop: 24 }]}>Urgência</Text>
          <View style={styles.urgenciaRow}>
            {[
              { key: 'sos', label: '🚨 SOS', sub: 'Agora mesmo' },
              { key: 'today', label: '⏰ Hoje', sub: 'Nas próximas horas' },
            ].map(u => (
              <TouchableOpacity key={u.key} style={styles.urgenciaCard}>
                <Text style={styles.urgenciaEmoji}>{u.label}</Text>
                <Text style={styles.urgenciaSub}>{u.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, !descricao.trim() && styles.btnDisabled]}
            disabled={!descricao.trim()}
            onPress={handleLocalizacao}
          >
            {isLocating ? (
              <ActivityIndicator color="#F5F0E8" />
            ) : (
              <Text style={styles.btnText}>Seguinte: Localização →</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* PASSO 3: Localização */}
      {step === 'localizacao' && location && (
        <ScrollView contentContainerStyle={styles.form}>
          <View style={styles.locationCard}>
            <Text style={styles.locationIcon}>📍</Text>
            <View>
              <Text style={styles.locationTitle}>Localização obtida</Text>
              <Text style={styles.locationCoords}>
                {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
              </Text>
              <Text style={styles.locationAccuracy}>Precisão: ±{Math.round(location.coords.accuracy ?? 0)} metros</Text>
            </View>
          </View>

          <Text style={styles.label}>Ponto de referência (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Junto ao Mercado do Xipamanine, portão azul"
            placeholderTextColor="#9CA3AF"
            value={referencia}
            onChangeText={setReferencia}
            maxLength={150}
          />
          <Text style={styles.hint}>As moradas formais são raras em Moçambique. Um ponto de referência ajuda muito o mestre!</Text>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleEnviar}>
            <Text style={styles.btnText}>🔍 Enviar e procurar mestre</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  )
}

const TINTA = '#1A1A2E'
const PAPEL = '#F5F0E8'
const AMARELO = '#F2C94C'
const ZINCO = '#6B7280'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPEL },
  header: { backgroundColor: TINTA, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { marginBottom: 12 },
  backText: { color: PAPEL, fontSize: 22 },
  headerTitle: { color: PAPEL, fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 12 },
  stepDots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { backgroundColor: AMARELO, width: 24 },
  dotDone: { backgroundColor: 'rgba(255,255,255,0.5)' },
  sectionLabel: { color: ZINCO, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 16 },
  categorias: { padding: 20, gap: 10 },
  catCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 16, borderWidth: 2, borderColor: 'transparent' },
  catEmoji: { fontSize: 32, marginRight: 16 },
  catInfo: { flex: 1 },
  catNome: { fontSize: 17, fontWeight: '800', color: TINTA, marginBottom: 2 },
  catDesc: { fontSize: 13, color: ZINCO },
  catArrow: { fontSize: 20, color: ZINCO },
  btnOutline: { marginTop: 16, paddingVertical: 16, borderWidth: 2, borderColor: TINTA, borderRadius: 6, alignItems: 'center' },
  btnOutlineText: { color: TINTA, fontWeight: '700', fontSize: 14 },
  form: { padding: 20, gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: TINTA, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  textarea: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 2, borderColor: '#E5E7EB', padding: 14, fontSize: 15, color: TINTA, minHeight: 110, textAlignVertical: 'top' },
  input: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 2, borderColor: '#E5E7EB', padding: 14, fontSize: 15, color: TINTA },
  charCount: { fontSize: 11, color: ZINCO, textAlign: 'right', marginTop: 4 },
  hint: { fontSize: 12, color: ZINCO, lineHeight: 18, marginTop: 8, marginBottom: 24 },
  urgenciaRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  urgenciaCard: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB' },
  urgenciaEmoji: { fontSize: 20, fontWeight: '800', marginBottom: 4, color: TINTA },
  urgenciaSub: { fontSize: 11, color: ZINCO, textAlign: 'center' },
  btnPrimary: { backgroundColor: TINTA, borderRadius: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: AMARELO, marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: PAPEL, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
  locationCard: { flexDirection: 'row', gap: 16, backgroundColor: '#ECFDF5', borderRadius: 8, padding: 16, borderWidth: 2, borderColor: '#6EE7B7', marginBottom: 24, alignItems: 'center' },
  locationIcon: { fontSize: 32 },
  locationTitle: { fontWeight: '800', color: '#065F46', fontSize: 15, marginBottom: 2 },
  locationCoords: { fontSize: 12, color: '#059669', fontFamily: 'monospace' },
  locationAccuracy: { fontSize: 11, color: '#6EE7B7', marginTop: 2 },
})
