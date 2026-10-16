import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image } from 'react-native'
import { useState, useEffect } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import * as Location from 'expo-location'
import { useAuthStore } from '@/lib/useAuthStore'
import { validateAntiPhoneBypass } from '@/lib/antiPhoneBypass'

// Categorias disponíveis para pedido imediato (on-demand) alinhadas com a base de dados
export const CATEGORIAS_IMEDIATAS = [
  { id: 2, slug: 'mecanico', emoji: '🚗', nome: 'Mecânico', desc: 'Avaria, motor, travões, socorro' },
  { id: 11, slug: 'electricista', emoji: '⚡', nome: 'Electricista', desc: 'Instalações, avarias, curto-circuito' },
  { id: 10, slug: 'canalizador', emoji: '🚿', nome: 'Canalizador', desc: 'Fugas de água, torneiras, entupimentos' },
  { id: 8, slug: 'pedreiro', emoji: '🧱', nome: 'Pedreiro', desc: 'Obras rápidas, reboco, fissuras' },
  { id: 12, slug: 'pintor', emoji: '🎨', nome: 'Pintor', desc: 'Paredes, tetos, retoques' },
  { id: 9, slug: 'carpinteiro', emoji: '🪚', nome: 'Carpinteiro', desc: 'Móveis, portas, fechaduras' },
  { id: 13, slug: 'chaveiro', emoji: '🔑', nome: 'Chaveiro / Serralheiro', desc: 'Fechaduras, portões, cópias' },
  { id: 31, slug: 'limpeza', emoji: '🧹', nome: 'Limpeza', desc: 'Residencial, escritórios, pós-obra' },
  { id: 32, slug: 'jardinagem', emoji: '🌿', nome: 'Jardineiro', desc: 'Poda, relva, manutenção' },
  { id: 33, slug: 'mudancas', emoji: '📦', nome: 'Mudanças', desc: 'Transporte e cargas' },
]

export default function NovoPedidoImediatoScreen() {
  const queryParams = useLocalSearchParams<{ categoria?: string }>()
  const profile = useAuthStore(s => s.profile)
  const loadProfile = useAuthStore(s => s.loadProfile)

  const [step, setStep] = useState<'categoria' | 'descricao' | 'localizacao'>('categoria')
  const [categoria, setCategoria] = useState<typeof CATEGORIAS_IMEDIATAS[0] | null>(null)
  const [descricao, setDescricao] = useState('')
  const [referencia, setReferencia] = useState('')
  const [bypassError, setBypassError] = useState<string | null>(null)
  const [refBypassError, setRefBypassError] = useState<string | null>(null)
  const [location, setLocation] = useState<Location.LocationObject | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)
  const [addressInfo, setAddressInfo] = useState<{
    rua: string
    bairro: string
    cidade: string
    completo: string
  } | null>(null)

  // Carregar dados de perfil se ainda não carregados
  useEffect(() => {
    if (!profile) {
      loadProfile()
    }
  }, [profile])

  // Pré-selecionar categoria se foi passada via URL
  useEffect(() => {
    if (queryParams.categoria) {
      const param = queryParams.categoria.toLowerCase()
      const found = CATEGORIAS_IMEDIATAS.find(c =>
        c.slug === param ||
        c.id.toString() === param ||
        (param === 'eletricista' && c.slug === 'electricista') ||
        (param === 'jardineiro' && c.slug === 'jardinagem')
      )
      if (found) {
        setCategoria(found)
        setStep('descricao')
      }
    }
  }, [queryParams.categoria])

  const handleDescricaoChange = (text: string) => {
    setDescricao(text)
    const validation = validateAntiPhoneBypass(text)
    if (!validation.isValid) {
      setBypassError(validation.errorMessage || 'Não é permitido partilhar contactos.')
    } else {
      setBypassError(null)
    }
  }

  const handleReferenciaChange = (text: string) => {
    setReferencia(text)
    const validation = validateAntiPhoneBypass(text)
    if (!validation.isValid) {
      setRefBypassError(validation.errorMessage || 'Não é permitido partilhar contactos.')
    } else {
      setRefBypassError(null)
    }
  }

  // Obter nome da rua/avenida via OpenStreetMap Nominatim
  const resolverMorada = async (latitude: number, longitude: number) => {
    setIsResolvingAddress(true)
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const response = await fetch(url, {
        headers: { 'User-Agent': 'BueDeMestres-App/1.0' },
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        const addr = data.address || {}

        const rua = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || 'Rua sem nome registado'
        const bairro = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || 'Bairro Zimpeto'
        const cidade = addr.city || addr.town || addr.municipality || 'Maputo'

        setAddressInfo({
          rua,
          bairro,
          cidade,
          completo: data.display_name || `${rua}, ${bairro}, ${cidade}`
        })
      } else {
        setAddressInfo({
          rua: 'Primeira Rua',
          bairro: 'Zimpeto',
          cidade: 'Maputo',
          completo: 'Primeira Rua, Zimpeto, Maputo'
        })
      }
    } catch {
      setAddressInfo({
        rua: 'Primeira Rua',
        bairro: 'Zimpeto',
        cidade: 'Maputo',
        completo: 'Primeira Rua, Zimpeto, Maputo'
      })
    } finally {
      setIsResolvingAddress(false)
    }
  }

  const handleLocalizacao = async () => {
    const validation = validateAntiPhoneBypass(descricao)
    if (!validation.isValid) {
      Alert.alert('Aviso de Segurança', validation.errorMessage)
      return
    }

    setIsLocating(true)
    let lat = -25.82898
    let lng = 32.58233
    let acc = 15

    try {
      const { status } = await Location.requestForegroundPermissionsAsync()

      if (status === 'granted') {
        const locationPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
        const loc = await Promise.race([locationPromise, timeoutPromise])

        if (loc) {
          lat = loc.coords.latitude
          lng = loc.coords.longitude
          acc = loc.coords.accuracy ?? 15
          setLocation(loc)
        } else {
          setLocation({
            coords: {
              latitude: lat,
              longitude: lng,
              altitude: null,
              accuracy: acc,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now()
          } as Location.LocationObject)
        }
      } else {
        setLocation({
          coords: {
            latitude: lat,
            longitude: lng,
            altitude: null,
            accuracy: acc,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now()
        } as Location.LocationObject)
      }
    } catch {
      setLocation({
        coords: {
          latitude: lat,
          longitude: lng,
          altitude: null,
          accuracy: acc,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now()
      } as Location.LocationObject)
    }

    setStep('localizacao')
    setIsLocating(false)
    await resolverMorada(lat, lng)
  }

  const handleEnviar = () => {
    if (!categoria) return
    const descValidation = validateAntiPhoneBypass(descricao)
    if (!descValidation.isValid) {
      Alert.alert('Aviso de Segurança', descValidation.errorMessage)
      return
    }

    const refValidation = validateAntiPhoneBypass(referencia)
    if (!refValidation.isValid) {
      Alert.alert('Aviso de Segurança', refValidation.errorMessage)
      return
    }

    const lat = location?.coords?.latitude ?? -25.82898
    const lng = location?.coords?.longitude ?? 32.58233
    const moradaEnvio = referencia || (addressInfo ? `${addressInfo.rua}, ${addressInfo.bairro}` : 'Maputo')

    router.push({
      pathname: '/pedido/a-procurar',
      params: {
        categoriaId: categoria.id.toString(),
        categoriaNome: categoria.nome,
        descricao,
        referencia: moradaEnvio,
        lat: lat.toString(),
        lng: lng.toString(),
      }
    })
  }

  return (
    <View style={styles.container}>
      {/* Cabeçalho com Foto e Nome do Usuário */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            onPress={() => step === 'categoria' ? router.back() : setStep(step === 'localizacao' ? 'descricao' : 'categoria')} 
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <View style={styles.userProfileBadge}>
            <Image
              source={{ uri: profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' }}
              style={styles.userAvatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {profile?.full_name || 'Cliente 1'}
              </Text>
              <Text style={styles.userRole}>
                {profile?.role === 'provider' ? 'Mestre Pro' : '👤 Cliente'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.headerTitle}>Pedir Mestre Agora</Text>
        <View style={styles.stepDots}>
          <View style={[styles.dot, step === 'categoria' && styles.dotActive]} />
          <View style={[styles.dot, step === 'descricao' && styles.dotActive, step === 'localizacao' && styles.dotDone]} />
          <View style={[styles.dot, step === 'localizacao' && styles.dotActive]} />
        </View>
      </View>

      {/* PASSO 1: Escolher Categoria */}
      {step === 'categoria' && (
        <ScrollView contentContainerStyle={styles.categorias}>
          <Text style={styles.sectionLabel}>DE QUE TIPO DE MESTRE PRECISAS?</Text>
          {CATEGORIAS_IMEDIATAS.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={styles.catCard}
              onPress={() => {
                setCategoria(cat)
                setStep('descricao')
              }}
              activeOpacity={0.8}
            >
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

      {/* PASSO 2: Descrição com Filtro Anti-Telefone */}
      {step === 'descricao' && (
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>Descreve o problema</Text>
          <TextInput
            style={[styles.textarea, bypassError && styles.inputError]}
            placeholder={`Ex: O motor do meu carro não arranca. Bateria em dia.`}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={descricao}
            onChangeText={handleDescricaoChange}
            maxLength={300}
          />
          <Text style={styles.charCount}>{descricao.length}/300</Text>

          {/* ALERTA ANTI-BYPASS DE TELEFONE */}
          {bypassError && (
            <View style={styles.bypassWarningBox}>
              <Text style={styles.bypassWarningIcon}>⚠️</Text>
              <Text style={styles.bypassWarningText}>{bypassError}</Text>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 16 }]}>Urgência</Text>
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
            style={[styles.btnPrimary, (!descricao.trim() || !!bypassError) && styles.btnDisabled]}
            disabled={!descricao.trim() || !!bypassError}
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

      {/* PASSO 3: Localização com Rua / Avenida e Coordenadas */}
      {step === 'localizacao' && location && (
        <ScrollView contentContainerStyle={styles.form}>
          <View style={styles.locationCard}>
            <Text style={styles.locationIcon}>📍</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.locationBadge}>LOCALIZAÇÃO IDENTIFICADA</Text>
                {isResolvingAddress && <ActivityIndicator size="small" color="#059669" />}
              </View>

              <Text style={styles.locationStreet}>
                🛣️ {addressInfo?.rua || 'A identificar rua / avenida...'}
              </Text>

              <Text style={styles.locationDistrict}>
                📍 {addressInfo ? `${addressInfo.bairro}, ${addressInfo.cidade}` : 'A processar zona de Maputo...'}
              </Text>

              <View style={styles.locationCoordsRow}>
                <Text style={styles.locationCoords}>
                  {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
                </Text>
                <Text style={styles.locationAccuracy}>
                  Precisão: ±{Math.round(location.coords.accuracy ?? 0)} metros
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.label}>Ponto de referência ou detalhes da rua</Text>
          <TextInput
            style={[styles.input, refBypassError && styles.inputError]}
            placeholder="Ex: Perto do Mercado, portão azul"
            placeholderTextColor="#9CA3AF"
            value={referencia}
            onChangeText={handleReferenciaChange}
          />
          {refBypassError ? (
            <Text style={styles.refErrorText}>⚠️ {refBypassError}</Text>
          ) : (
            <Text style={styles.hint}>
              Em Moçambique o ponto de referência ajuda o mestre a chegar directamente ao portão sem telefonemas.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.btnPrimary, !!refBypassError && styles.btnDisabled]}
            disabled={!!refBypassError}
            onPress={handleEnviar}
          >
            <Text style={styles.btnText}>Procurar Mestre Disponível →</Text>
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
  header: { backgroundColor: TINTA, paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 4 },
  backText: { color: PAPEL, fontSize: 24, fontWeight: '700' },
  
  userProfileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AMARELO,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  userInfo: {
    justifyContent: 'center',
  },
  userName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 120,
  },
  userRole: {
    color: AMARELO,
    fontSize: 10,
    fontWeight: '700',
  },

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
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  bypassWarningBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FEE2E2', borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 8, padding: 12, marginTop: 8, alignItems: 'flex-start' },
  bypassWarningIcon: { fontSize: 18 },
  bypassWarningText: { flex: 1, color: '#991B1B', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  refErrorText: { color: '#B91C1C', fontSize: 11, fontWeight: 'bold', marginTop: 4, marginBottom: 12 },
  charCount: { fontSize: 11, color: ZINCO, textAlign: 'right', marginTop: 4 },
  hint: { fontSize: 12, color: ZINCO, lineHeight: 18, marginTop: 8, marginBottom: 24 },
  urgenciaRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  urgenciaCard: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB' },
  urgenciaEmoji: { fontSize: 20, fontWeight: '800', marginBottom: 4, color: TINTA },
  urgenciaSub: { fontSize: 11, color: ZINCO, textAlign: 'center' },
  btnPrimary: { backgroundColor: TINTA, borderRadius: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: AMARELO, marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: PAPEL, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },

  // Card de Localização com Rua e Avenida
  locationCard: { 
    flexDirection: 'row', 
    gap: 14, 
    backgroundColor: '#ECFDF5', 
    borderRadius: 12, 
    padding: 16, 
    borderWidth: 2, 
    borderColor: '#34D399', 
    marginBottom: 20, 
    alignItems: 'flex-start' 
  },
  locationIcon: { fontSize: 28, marginTop: 2 },
  locationBadge: { fontSize: 10, fontWeight: '900', color: '#047857', letterSpacing: 1 },
  locationStreet: { fontSize: 16, fontWeight: '900', color: '#064E3B', marginTop: 2, lineHeight: 22 },
  locationDistrict: { fontSize: 13, fontWeight: '600', color: '#047857', marginTop: 4 },
  locationCoordsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  locationCoords: { fontSize: 11, color: '#059669', fontFamily: 'monospace', fontWeight: '700' },
  locationAccuracy: { fontSize: 11, color: '#059669' },
})
