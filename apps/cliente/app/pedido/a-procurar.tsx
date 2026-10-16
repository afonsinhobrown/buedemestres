import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, Image } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/useAuthStore'

const RONDAS = [
  { ronda: 1, raioKm: 5, label: 'A procurar a 5 km...' },
  { ronda: 2, raioKm: 10, label: 'A alargar para 10 km...' },
  { ronda: 3, raioKm: 20, label: 'A alargar para 20 km...' },
]

export default function AProcurarMestreScreen() {
  const params = useLocalSearchParams<{
    categoriaId: string
    categoriaNome: string
    descricao: string
    referencia: string
    lat: string
    lng: string
  }>()

  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const loadProfile = useAuthStore((s) => s.loadProfile)

  useEffect(() => {
    if (!profile) loadProfile()
  }, [profile])
  const [rondaAtual, setRondaAtual] = useState(0)
  const [esgotado, setEsgotado] = useState(false)
  const [aceite, setAceite] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [mestreDados, setMestreDados] = useState<{ nome: string; telefone: string; nota: string }>({
    nome: 'Mestre Profissional',
    telefone: '',
    nota: '4.9'
  })
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Animação de pulso
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [])

  // Verificar mestres online da categoria na zona
  useEffect(() => {
    async function checkOnline() {
      const catId = parseInt(params.categoriaId || '2')
      const { data } = await supabase
        .from('provider_presence')
        .select('provider_id')
        .eq('is_online', true)
        .contains('categories', [catId])
      
      if (data) {
        setOnlineCount(data.length)
      }
    }
    checkOnline()
  }, [params.categoriaId])

  // Criar o pedido no Supabase
  useEffect(() => {
    async function criarPedido() {
      // Usar utilizador real autenticado da sessão
      const realUserId = user?.id || '11111111-1111-1111-1111-111111111111';
      const realUserName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Cliente Registado';
      const lng = params.lng || '32.5700';
      const lat = params.lat || '-25.9680';

      // 1. Garantir que o perfil existe
      await supabase.from('profiles').upsert({
        id: realUserId,
        full_name: realUserName,
        role: 'client'
      }, { onConflict: 'id' });

      // 2. Criar o pedido associado ao cliente real com a categoria certa
      const { data, error } = await supabase
        .from('service_requests')
        .insert({
          client_id: realUserId,
          title: `Pedido urgente: ${params.categoriaNome}`,
          category_id: parseInt(params.categoriaId || '2'),
          description: params.descricao || 'Pedido urgente de assistência',
          location_note: params.referencia || '',
          mode: 'on_demand',
          location: `POINT(${lng} ${lat})`,
          search_radius_m: 5000,
        })
        .select()
        .single();
        
      if (error) {
        console.error('Insert Error:', error);
        Alert.alert('Erro', 'Não foi possível criar o pedido.');
        router.back();
        return;
      }
      
      setRequestId(data.id);
    }
    
    criarPedido();
  }, []);

  // Escutar ofertas aceites e progressão de rondas (Polling activo + Realtime)
  useEffect(() => {
    if (!requestId) return;

    let timer: NodeJS.Timeout;
    let pollTimer: NodeJS.Timeout;

    const tratarAceitacao = async (targetProviderId: string | null) => {
      clearInterval(timer);
      clearInterval(pollTimer);

      let mNome = 'Provedor 1';
      let mTel = '+258 84 999 9999';
      let mNota = '5.0';

      if (targetProviderId) {
        const { data: prov } = await supabase
          .from('provider_profiles')
          .select('business_name, rating_avg, profiles:profile_id(full_name, phone)')
          .eq('profile_id', targetProviderId)
          .single();

        if (prov) {
          mNome = prov.business_name || (prov.profiles as any)?.full_name || mNome;
          mTel = (prov.profiles as any)?.phone || mTel;
          if (prov.rating_avg) mNota = Number(prov.rating_avg).toFixed(1);
        }
      }

      setMestreDados({ nome: mNome, telefone: mTel, nota: mNota });
      setAceite(true);
    };

    // 1. Polling contínuo a cada 2 segundos (garante detecção imediata mesmo com aba em background)
    const verificarEstadoPedido = async () => {
      try {
        const { data: req } = await supabase
          .from('service_requests')
          .select('id, status, target_provider_id')
          .eq('id', requestId)
          .maybeSingle();

        if (req && (req.status === 'accepted' || req.status === 'price_proposed')) {
          console.log('✅ Pedido aceite ou orçamento recebido detectado via polling:', req);
          await tratarAceitacao(req.target_provider_id);
          if (req.status === 'price_proposed') {
            router.replace({
              pathname: '/pedido/proposta-preco',
              params: {
                jobId: requestId,
                mestreNome: 'Provedor 1',
                categoriaEmoji: '🔧'
              }
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar estado do pedido:', err);
      }
    };

    verificarEstadoPedido();
    pollTimer = setInterval(verificarEstadoPedido, 2000);

    // 2. Subscrição Realtime instantânea
    const clientChannelId = `client_req_${requestId}_${Date.now()}`;
    const channel = supabase
      .channel(clientChannelId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_requests',
          filter: `id=eq.${requestId}`,
        },
        async (payload) => {
          if (payload.new.status === 'accepted' || payload.new.status === 'price_proposed') {
            console.log('✅ Pedido aceite ou orçamento recebido detectado via Realtime:', payload.new);
            await tratarAceitacao(payload.new.target_provider_id);
            if (payload.new.status === 'price_proposed') {
              router.replace({
                pathname: '/pedido/proposta-preco',
                params: {
                  jobId: requestId,
                  mestreNome: 'Provedor 1',
                  categoriaEmoji: '🔧'
                }
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Cliente Realtime Status [${clientChannelId}]:`, status);
      });

    // 3. Rondas de procura com tempo confortável (35s por ronda = ~105s total)
    timer = setInterval(() => {
      setRondaAtual((prev) => {
        if (prev >= RONDAS.length - 1) {
          clearInterval(timer);
          clearInterval(pollTimer);
          setEsgotado(true);
          return prev;
        }
        return prev + 1;
      });
    }, 35000);

    return () => {
      clearInterval(timer);
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  if (aceite) {
    return (
      <View style={[styles.container, { backgroundColor: '#0F2D1A' }]}>
        <Text style={{ fontSize: 60, marginBottom: 16 }}>🎉</Text>
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#F5F0E8', textAlign: 'center', marginBottom: 10 }}>
          Mestre Encontrado!
        </Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#F2C94C', textAlign: 'center', marginBottom: 8 }}>
          {mestreDados.nome}
        </Text>
        <Text style={{ fontSize: 14, color: '#E2E8F0', textAlign: 'center', marginBottom: 24, paddingHorizontal: 16, lineHeight: 22 }}>
          ⭐ {mestreDados.nota} · O profissional aceitou atender o seu pedido e está a analisar o problema para propor o valor no sistema.
        </Text>

        <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 16, marginBottom: 28, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
          <Text style={{ color: '#4ADE80', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
            🔒 Regra de Segurança Bué de Mestres
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18 }}>
            O mestre só inicia a deslocação após o acordo do preço e confirmação do pagamento retido (Escrow).
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.btnPrimary, { backgroundColor: '#F2C94C', borderColor: '#F2C94C', width: '100%' }]} 
          onPress={() => router.replace({
            pathname: '/pedido/proposta-preco',
            params: {
              jobId: requestId || '',
              mestreNome: mestreDados.nome,
              categoriaEmoji: '🔧'
            }
          })}
        >
          <Text style={[styles.btnText, { color: '#1A1A2E' }]}>VER ORÇAMENTO & NEGOCIAR →</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (esgotado) {
    return (
      <View style={styles.container}>
        <Text style={styles.esgotadoIcon}>😔</Text>
        <Text style={styles.esgotadoTitle}>Nenhum mestre disponível</Text>
        <Text style={styles.esgotadoDesc}>
          Não encontrámos nenhum {params.categoriaNome} disponível na tua zona neste momento.
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/pedido/orcamento')}>
          <Text style={styles.btnText}>Pedir orçamentos (Modo Agendado)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => router.back()}>
          <Text style={styles.btnOutlineText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Barra de Topo com Foto e Nome do Usuário */}
      <View style={styles.topProfileBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.userProfileBadge}>
          <Image
            source={{ uri: profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' }}
            style={styles.userAvatar}
          />
          <View>
            <Text style={styles.userName} numberOfLines={1}>{profile?.full_name || 'Cliente 1'}</Text>
            <Text style={styles.userRole}>👤 Cliente</Text>
          </View>
        </View>
      </View>

      {/* Animação de radar */}
      <View style={styles.radarContainer}>
        <Animated.View style={[styles.radarOuter, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.radarMid, { transform: [{ scale: pulseAnim }], opacity: 0.6 }]} />
        <View style={styles.radarCenter}>
          <Text style={styles.radarEmoji}>📍</Text>
        </View>
      </View>

      <Text style={styles.titulo}>A procurar mestre</Text>
      <Text style={styles.subtitulo}>{params.categoriaNome}</Text>

      {params.referencia ? (
        <View style={styles.addressPill}>
          <Text style={styles.addressText} numberOfLines={2}>
            🛣️ {params.referencia}
          </Text>
        </View>
      ) : null}

      {onlineCount !== null && (
        <View style={{ backgroundColor: onlineCount > 0 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(242, 201, 76, 0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: onlineCount > 0 ? 'rgba(74, 222, 128, 0.3)' : 'rgba(242, 201, 76, 0.3)' }}>
          <Text style={{ color: onlineCount > 0 ? '#4ADE80' : '#F2C94C', fontSize: 13, fontWeight: '700' }}>
            {onlineCount > 0 ? `🟢 ${onlineCount} mestre(s) online nesta especialidade` : '⏳ A aguardar resposta dos mestres...'}
          </Text>
        </View>
      )}

      {/* Indicador de ronda */}
      <View style={styles.rondasContainer}>
        {RONDAS.map((r, i) => (
          <View key={r.ronda} style={styles.rondaRow}>
            <View style={[
              styles.rondaDot,
              i < rondaAtual && styles.rondaDotDone,
              i === rondaAtual && styles.rondaDotActive,
            ]} />
            <Text style={[
              styles.rondaLabel,
              i === rondaAtual && styles.rondaLabelActive,
              i < rondaAtual && styles.rondaLabelDone,
            ]}>
              {r.label}
            </Text>
            {i < rondaAtual && <Text style={styles.rondaCheck}>✓</Text>}
          </View>
        ))}
      </View>

      <Text style={styles.hint}>
        Assim que um mestre aceitar, verás o nome, a foto e o tempo estimado de chegada.
      </Text>

      <TouchableOpacity
        style={styles.btnCancel}
        onPress={() => {
          router.back()
        }}
      >
        <Text style={styles.btnCancelText}>Cancelar pedido</Text>
      </TouchableOpacity>
    </View>
  )
}

const TINTA = '#1A1A2E'
const PAPEL = '#F5F0E8'
const AMARELO = '#F2C94C'
const ZINCO = '#6B7280'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TINTA, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: 48 },
  topProfileBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  userProfileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  addressPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 24,
    maxWidth: '90%',
  },
  addressText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  radarContainer: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  radarOuter: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(242,201,76,0.08)', borderWidth: 1, borderColor: 'rgba(242,201,76,0.15)' },
  radarMid: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(242,201,76,0.12)', borderWidth: 1, borderColor: 'rgba(242,201,76,0.25)' },
  radarCenter: { width: 64, height: 64, borderRadius: 32, backgroundColor: AMARELO, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  radarEmoji: { fontSize: 28 },
  titulo: { fontSize: 26, fontWeight: '900', color: PAPEL, textAlign: 'center', letterSpacing: -0.5, marginBottom: 6 },
  subtitulo: { fontSize: 16, color: AMARELO, fontWeight: '700', marginBottom: 40 },
  rondasContainer: { width: '100%', gap: 16, marginBottom: 32 },
  rondaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rondaDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.15)' },
  rondaDotActive: { backgroundColor: AMARELO, width: 12, height: 12, borderRadius: 6 },
  rondaDotDone: { backgroundColor: '#4ADE80' },
  rondaLabel: { flex: 1, color: 'rgba(255,255,255,0.35)', fontSize: 14 },
  rondaLabelActive: { color: PAPEL, fontWeight: '700' },
  rondaLabelDone: { color: 'rgba(255,255,255,0.55)', textDecorationLine: 'line-through' },
  rondaCheck: { color: '#4ADE80', fontWeight: '900', fontSize: 14 },
  hint: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20, marginBottom: 40 },
  btnCancel: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  btnCancelText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 14 },
  // Ecrã esgotado
  esgotadoIcon: { fontSize: 56, marginBottom: 16 },
  esgotadoTitle: { fontSize: 22, fontWeight: '900', color: PAPEL, textAlign: 'center', marginBottom: 12 },
  esgotadoDesc: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  btnPrimary: { width: '100%', backgroundColor: AMARELO, borderRadius: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: '#fff', marginBottom: 12 },
  btnText: { color: TINTA, fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  btnOutline: { width: '100%', paddingVertical: 16, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center' },
  btnOutlineText: { color: PAPEL, fontWeight: '700', fontSize: 14 },
})
