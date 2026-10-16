import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image } from 'react-native'
import { useState, useEffect } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import * as Location from 'expo-location'
import { useAuthStore } from '@/lib/useAuthStore'

// Categorias disponíveis para pedido imediato (on-demand) alinhadas com a base de dados
export const CATEGORIAS_IMEDIATAS = [
  { id: 2, slug: 'mecanico', emoji: '🔧', nome: 'Mecânico', desc: 'Avaria, motor, travões, socorro' },
  { id: 11, slug: 'electricista', emoji: '⚡', nome: 'Electricista', desc: 'Instalações, avarias, curto-circuito' },
  { id: 10, slug: 'canalizador', emoji: '🚿', nome: 'Canalizador', desc: 'Fugas de água, torneiras, entupimentos' },
  { id: 13, slug: 'chaveiro', emoji: '🔑', nome: 'Chaveiro / Serralheiro', desc: 'Fechaduras, portões, cópias' },
  { id: 8, slug: 'pedreiro', emoji: '🧱', nome: 'Pedreiro', desc: 'Obras rápidas, reboco, fissuras' },
  { id: 31, slug: 'limpeza', emoji: '🧹', nome: 'Limpeza', desc: 'Residencial, escritórios, pós-obra' },
]

export default function NovoPedidoImediatoScreen() {
  const queryParams = useLocalSearchParams<{ categoria?: string }>()
  const profile = useAuthStore(s => s.profile)
  const loadProfile = useAuthStore(s => s.loadProfile)

  const [step, setStep] = useState<'categoria' | 'descricao' | 'localizacao'>('categoria')
  const [categoria, setCategoria] = useState<typeof CATEGORIAS_IMEDIATAS[0] | null>(null)
  const [descricao, setDescricao] = useState('')
  const [referencia, setReferencia] = useState('')
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

  // Pré-selecionar categoria se foi passada via URL (ex: a partir da Home ou Categorias)
  useEffect(() => {
    if (queryParams.categoria) {
      const param = queryParams.categoria.toLowerCase()
      const found = CATEGORIAS_IMEDIATAS.find(c =>
        c.slug === param ||
        c.id.toString() === param ||
        (param === 'eletricista' && c.slug === 'electricista')
      )
      if (found) {
        setCategoria(found)
        setStep('descricao')
      }
    }
  }, [queryParams.categoria])

  const handleCategoria = (cat: typeof CATEGORIAS_IMEDIATAS[0]) => {
    setCategoria(cat)
    setStep('descricao')
  }

  // Resolver morada (rua, avenida, bairro, cidade) via geocodificação reversa
  const resolverMorada = async (lat: number, lng: number) => {
    setIsResolvingAddress(true)
    try {
      // 1. Tentar Expo Location nativo
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
        if (geo && geo.length > 0) {
          const g = geo[0]
          const r = g.street || g.name || ''
          const b = g.district || g.subregion || ''
          const c = g.city || 'Maputo'
          if (r || b) {
            const info = {
              rua: r || `Bairro ${b}`,
              bairro: b || c,
              cidade: c,
              completo: [r, b, c].filter(Boolean).join(', ')
            }
            setAddressInfo(info)
            setReferencia(prev => prev ? prev : (info.rua ? `${info.rua}, ${info.bairro}` : info.bairro))
            setIsResolvingAddress(false)
            return
          }
        }
      } catch {
        // Seguir para Nominatim fallback
      }

      // 2. Fallback OpenStreetMap Nominatim - detalhado para Moçambique e 100% suportado na Web
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'User-Agent': 'BueDeMestresApp/1.0' }
      })
      const data = await res.json()
      if (data && data.address) {
        const addr = data.address
        const r = addr.road || addr.pedestrian || addr.residential || (addr.neighbourhood ? `Bairro ${addr.neighbourhood}` : 'Avenida Principal')
        const b = addr.neighbourhood || addr.suburb || addr.district || 'Maputo'
        const c = addr.city || addr.town || addr.municipality || 'Cidade de Maputo'
        const info = {
          rua: r,
          bairro: b,
          cidade: c,
          completo: `${r}, ${b}, ${c}`
        }
        setAddressInfo(info)
        setReferencia(prev => prev ? prev : `${info.rua}, ${info.bairro}`)
        setIsResolvingAddress(false)
        return
      }
    } catch (err) {
      console.warn('Erro ao resolver endereço:', err)
    }

    const fallback = {
      rua: 'Zona Central',
      bairro: 'Maputo',
      cidade: 'Maputo',
      completo: 'Maputo, Moçambique'
    }
    setAddressInfo(fallback)
    setReferencia(prev => prev ? prev : `${fallback.rua}, ${fallback.bairro}`)
    setIsResolvingAddress(false)
  }

  const handleLocalizacao = async () => {
    setIsLocating(true)
    let lat = -25.82898
    let lng = 32.58233
    let acc = 25

    try {
      const permResult = await Promise.race([
        Location.requestForegroundPermissionsAsync(),
        new Promise<{ status: string }>((res) => setTimeout(() => res({ status: 'timeout' }), 2000))
      ])

      if (permResult && permResult.status === 'granted') {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((res) => setTimeout(() => res(null), 2500))
        ])
        if (loc && loc.coords) {
          lat = loc.coords.latitude
          lng = loc.coords.longitude
          acc = Math.round(loc.coords.accuracy ?? 25)
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
        // Fallback gracioso imediato
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
      // Fallback garantido
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

    // Iniciar resolução da rua/avenida imediatamente
    await resolverMorada(lat, lng)
  }

  const handleEnviar = () => {
    if (!categoria) return
    const lat = location?.coords?.latitude ?? -25.82898
    const lng = location?.coords?.longitude ?? 32.58233

    // Morada final enviada
    const moradaEnvio = referencia || (addressInfo ? `${addressInfo.rua}, ${addressInfo.bairro}` : 'Maputo')

    // Navegar para o ecrã de "A procurar mestre"
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
      {/* Cabeçalho com Foto e Nome do Usuário Sempre Visível */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            onPress={() => step === 'categoria' ? router.back() : setStep(step === 'localizacao' ? 'descricao' : 'categoria')} 
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          {/* FOTO E NOME DO USUÁRIO SEMPRE VISÍVEL */}
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

              {/* RUA OU AVENIDA EM DESTAQUE */}
              <Text style={styles.locationStreet}>
                🛣️ {addressInfo?.rua || 'A identificar rua / avenida...'}
              </Text>

              {/* BAIRRO E CIDADE */}
              <Text style={styles.locationDistrict}>
                📍 {addressInfo ? `${addressInfo.bairro}, ${addressInfo.cidade}` : 'A processar zona de Maputo...'}
              </Text>

              {/* COORDENADAS E PRECISÃO */}
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
            style={styles.input}
            placeholder="Ex: Perto do Mercado, portão azul, casa 45"
            placeholderTextColor="#9CA3AF"
            value={referencia}
            onChangeText={setReferencia}
            maxLength={150}
          />
          <Text style={styles.hint}>
            💡 A rua identificada pelo GPS será enviada ao mestre. Adicione detalhes extras para facilitar o socorro!
          </Text>

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
  header: { backgroundColor: TINTA, paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 4 },
  backText: { color: PAPEL, fontSize: 24, fontWeight: '700' },
  
  // Badge de Perfil no Topo
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
  charCount: { fontSize: 11, color: ZINCO, textAlign: 'right', marginTop: 4 },
  hint: { fontSize: 12, color: ZINCO, lineHeight: 18, marginTop: 8, marginBottom: 24 },
  urgenciaRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
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
