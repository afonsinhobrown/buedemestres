import { View, Text, StyleSheet, Switch, TouchableOpacity, Platform, Modal, TextInput, ActivityIndicator, Image, ScrollView } from 'react-native'
import { Alert } from '../lib/alertCompat'
import { useState, useEffect, useRef } from 'react'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'
import { loadSandboxSettings } from '../lib/sandbox'
import { getDeviceId } from '../lib/deviceId'

const formatJobTitle = (title?: string, catId?: number) => {
  if (!title || title.includes('undefined')) {
    const catMap: Record<number, string> = {
      2: 'Mecânico',
      11: 'Electricista',
      10: 'Canalizador',
      8: 'Pedreiro',
      9: 'Carpinteiro',
      12: 'Pintor',
      13: 'Chaveiro / Serralheiro',
      31: 'Limpeza',
      32: 'Jardinagem'
    };
    const name = catId ? catMap[catId] : null;
    return name ? `Pedido urgente: ${name}` : 'Pedido urgente: Mecânico';
  }
  return title;
};

export default function ProHomeScreen() {
  const [isOnline, setIsOnline] = useState(false)
  const [newRequest, setNewRequest] = useState<any>(null)
  const [trabalhosHoje, setTrabalhosHoje] = useState(0)
  const [pendingJobs, setPendingJobs] = useState<any[]>([])
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [providerProfile, setProviderProfile] = useState<any>(null)
  const [availableProviders, setAvailableProviders] = useState<any[]>([])
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [heldAmount, setHeldAmount] = useState<number>(0)
  const [financeSummary, setFinanceSummary] = useState({ devido: 0, pago: 0, faturacao: 0 })
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [sandbox, setSandbox] = useState<{ active: boolean; min: number; max: number } | null>(null)
  const user = useAuthStore(s => s.user)
  const storeProvider = useAuthStore(s => s.providerProfile)
  const signOut = useAuthStore(s => s.signOut)
  const recusadosRef = useRef<Set<string>>(new Set())
  const deviceBlockedRef = useRef(false)
  const isVerified = providerProfile?.verification === 'approved'

  const handleSignOut = () => {
    Alert.alert('Terminar sessão', 'Queres sair da tua conta de mestre?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
    ])
  }

  // Carregar dados do Mestre e sua Especialidade/Categoria Real com Join da tabela categories
  useEffect(() => {
    async function carregarPerfilMestre() {
      try {
        const { data: provs, error } = await supabase
          .from('provider_profiles')
          .select(`
            profile_id,
            business_name,
            primary_category_id,
            is_available,
            verification,
            categories:primary_category_id (
              id,
              name,
              slug
            )
          `)
          .eq('is_published', true)
        
        if (provs && provs.length > 0) {
          setAvailableProviders(provs)
          const matched = provs.find(p => p.profile_id === user?.id) || storeProvider

          if (!matched) {
            setProviderProfile(null)
            setIsOnline(false)
            return
          }

          // Carregar dados de avatar/nome de profiles directamente
          const { data: profData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', matched.profile_id)
            .maybeSingle()

          const { data: catRows } = await supabase
            .from('provider_categories')
            .select('category_id')
            .eq('provider_id', matched.profile_id)

          const ids = Array.from(new Set([
            Number(matched.primary_category_id) || 0,
            ...((catRows || []).map((c: any) => Number(c.category_id)))
          ].filter(Boolean)))

          setCategoryIds(ids)

          const profileCompleto = {
            ...matched,
            profiles: profData || {
              full_name: matched.business_name || 'Mestre',
              avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
            }
          }

          setProviderProfile(profileCompleto)

          const aprovado = matched.verification === 'approved'
          if (!aprovado) {
            setIsOnline(false)
            return
          }

          // Só um dispositivo pode ficar online com a mesma conta de mestre.
          const deviceId = await getDeviceId()
          const { data: claimed, error: claimError } = await supabase.rpc('provider_claim_device', {
            p_provider: matched.profile_id,
            p_device_id: deviceId,
            p_categories: ids.length ? ids : [2]
          })

          if (claimError) {
            console.warn('Erro ao reclamar dispositivo:', claimError.message)
            setIsOnline(false)
            return
          }

          const ficouOnline = claimed === true
          setIsOnline(ficouOnline)

          if (ficouOnline) {
            deviceBlockedRef.current = false
          } else if (!deviceBlockedRef.current) {
            deviceBlockedRef.current = true
            Alert.alert(
              'Conta activa noutro dispositivo',
              'Esta conta de mestre já está online noutro dispositivo. Desliga-a nesse dispositivo para poderes ficar online aqui.'
            )
          }
        } else if (error) {
          console.error('Erro ao carregar provedores reais:', error)
        }
      } catch (err) {
        console.error('Excepção ao carregar perfil do mestre:', err)
      }
    }
    carregarPerfilMestre()
  }, [user, storeProvider])

  useEffect(() => {
    const proId = providerProfile?.profile_id
    if (!proId) return

    let active = true
    const carregarSaldo = async () => {
      const [{ data }, { data: jobRows }, { data: payoutRows }, { data: heldRows }] = await Promise.all([
        supabase.from('wallets').select('balance').eq('profile_id', proId).maybeSingle(),
        supabase
          .from('jobs')
          .select('id, agreed_amount, job_payments:job_payments(amount, provider_payout, status)')
          .eq('provider_id', proId)
          .eq('status', 'completed'),
        supabase.from('payouts').select('job_id, status').eq('provider_id', proId),
        supabase.from('job_payments').select('amount, provider_payout').eq('provider_id', proId).eq('status', 'held'),
      ])
      if (!active) return
      setWalletBalance(Number(data?.balance || 0))
      setHeldAmount(
        ((heldRows as any[]) || []).reduce(
          (total, row) => total + Number(row.provider_payout ?? row.amount ?? 0),
          0
        )
      )

      const payouts = (payoutRows as any[]) || []
      const summary = ((jobRows as any[]) || []).reduce(
        (acc, job) => {
          const raw = job.job_payments
          const payment = Array.isArray(raw) ? raw[0] : raw
          const bruto = Number(payment?.amount || job.agreed_amount || 0)
          const liquido = Number(payment?.provider_payout || 0)
          const payout = payouts.find((p) => p.job_id === job.id)
          acc.faturacao += bruto
          if (payout?.status === 'completed') acc.pago += liquido
          else acc.devido += liquido
          return acc
        },
        { devido: 0, pago: 0, faturacao: 0 }
      )
      setFinanceSummary(summary)
    }

    carregarSaldo()
    const timer = setInterval(carregarSaldo, 15000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [providerProfile?.profile_id])

  useEffect(() => {
    let mounted = true
    loadSandboxSettings()
      .then((settings) => {
        if (mounted) setSandbox(settings)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const proId = providerProfile?.profile_id
    if (!proId) return
    let active = true
    const carregarNaoLidas = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', proId)
        .is('read_at', null)
      if (active) setUnreadCount(count || 0)
    }
    carregarNaoLidas()
    const timer = setInterval(carregarNaoLidas, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [providerProfile?.profile_id])

  // Manter heartbeat de presença enquanto online (PostGIS requer updated_at recente)
  useEffect(() => {
    if (!isOnline || !providerProfile) return

    const proId = providerProfile.profile_id

    const heartbeat = setInterval(async () => {
      const deviceId = await getDeviceId()
      const { data: claimed, error } = await supabase.rpc('provider_claim_device', {
        p_provider: proId,
        p_device_id: deviceId,
        p_categories: categoryIds.length ? categoryIds : [2]
      })

      if (error) {
        console.warn('Heartbeat de presença:', error.message)
        return
      }

      if (claimed !== true) {
        setIsOnline(false)
        Alert.alert(
          'Sessão noutro dispositivo',
          'A tua conta foi activada noutro dispositivo. Esta sessão ficou offline.'
        )
      }
    }, 40000)

    return () => clearInterval(heartbeat)
  }, [isOnline, providerProfile, categoryIds])

  // Busca e actualização constante de pedidos (Polling activo a cada 2.5s + Realtime)
  useEffect(() => {
    if (!isOnline || !providerProfile || providerProfile.verification !== 'approved') {
      setNewRequest(null)
      setPendingJobs([])
      return
    }

    const activeProId = providerProfile.profile_id

    const pollPedidos = async () => {
      try {
        // Um mestre só pode atender um serviço de cada vez.
        const { data: ocupado } = await supabase.rpc('provider_has_active_job', {
          p_provider: activeProId
        })
        if (ocupado === true) {
          setPendingJobs([])
          setNewRequest(null)
          return
        }

        let reqQuery = supabase
          .from('service_requests')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false })

        if (categoryIds.length > 0) {
          reqQuery = reqQuery.in('category_id', categoryIds)
        }

        const [{ data: requests }, { data: targeted }, { data: recusas }] = await Promise.all([
          reqQuery,
          supabase
            .from('service_requests')
            .select('*')
            .eq('status', 'open')
            .eq('target_provider_id', activeProId),
          supabase
            .from('request_offers')
            .select('request_id')
            .eq('provider_id', activeProId)
            .eq('status', 'declined'),
        ])

        for (const recusa of recusas || []) {
          if (recusa?.request_id) recusadosRef.current.add(recusa.request_id)
        }

        const porId = new Map<string, any>()
        for (const r of [...(requests || []), ...(targeted || [])]) {
          if (r?.id) porId.set(r.id, r)
        }

        const visiveis = Array.from(porId.values())
          .filter(r => !recusadosRef.current.has(r.id))
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

        setPendingJobs(visiveis)
        setNewRequest((current: any) => {
          if (current) return current
          return visiveis[0] || null
        })
      } catch (err) {
        console.warn('Erro ao sondar pedidos:', err)
      }
    }

    // Executa imediatamente e a cada 2.5 segundos
    pollPedidos()
    const pollInterval = setInterval(pollPedidos, 2500)

    // Subscrição Realtime com ID único para notificação instantânea (sub-segundo)
    const channelId = `pro_realtime_${activeProId}_${Date.now()}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_requests' },
        (payload) => {
          if (recusadosRef.current.has(payload.new.id)) return
          const direcionado = payload.new.target_provider_id === activeProId
          const daCategoria = categoryIds.length === 0 || categoryIds.includes(Number(payload.new.category_id))
          if (!direcionado && !daCategoria) return
          console.log('🚨 RECEBIDO NOVO PEDIDO URGENTE VIA REALTIME:', payload.new)
          setNewRequest(payload.new)
          setPendingJobs(prev => [payload.new, ...prev.filter(j => j.id !== payload.new.id)])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests' },
        (payload) => {
          if (payload.new.status !== 'open') {
            setPendingJobs(prev => prev.filter(j => j.id !== payload.new.id))
            setNewRequest((curr: any) => (curr?.id === payload.new.id ? null : curr))
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Pro Realtime Status [${channelId}]:`, status)
      })

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [isOnline, providerProfile, categoryIds])

  const aceitarTrabalho = async (req: any) => {
    const requestId = typeof req === 'string' ? req : req.id
    const jobTitle = typeof req === 'object' 
      ? formatJobTitle(req.title || req.problem_description, req.category_id) 
      : 'Serviço'
    const activeProId = providerProfile?.profile_id || user?.id

    // Anti-abuso: cooldown por faltas repetidas em negociações
    if (activeProId) {
      const { data: podeAceitar } = await supabase.rpc('provider_can_accept', { p_provider: activeProId })
      if (podeAceitar === false) {
        Alert.alert(
          'Temporariamente suspenso',
          'Não respondeste a tempo em demasiadas negociações. Aguarda alguns minutos antes de aceitar novos pedidos.'
        )
        return
      }
    }

    if (!activeProId) {
      Alert.alert('Erro', 'Não foi possível identificar o teu perfil de mestre.')
      return
    }

    // Um mestre só pode atender um serviço de cada vez.
    const { data: ocupado } = await supabase.rpc('provider_has_active_job', {
      p_provider: activeProId,
      p_exclude_request: requestId
    })
    if (ocupado === true) {
      Alert.alert(
        'Já tens um serviço activo',
        'Conclui ou cancela o serviço que já aceitaste antes de aceitar outro pedido.'
      )
      return
    }

    const { data: providerProfileRow } = await supabase
      .from('provider_profiles')
      .select('trial_started_at, trial_ends_at')
      .eq('profile_id', activeProId)
      .maybeSingle()

    const { data: rateRows } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['trial_services', 'trial_days'])
    const rateMap = new Map((rateRows || []).map((row: any) => [row.key, row.value]))
    const trialServices = Number(rateMap.get('trial_services') ?? 5)
    const trialActive = Boolean(
      providerProfileRow?.trial_ends_at && new Date(providerProfileRow.trial_ends_at).getTime() > Date.now()
    )

    let canAccept = false
    if (trialActive) {
      const { count: trialJobs } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', activeProId)
        .gte('accepted_at', providerProfileRow?.trial_started_at || new Date(0).toISOString())
        .neq('status', 'cancelled')
      canAccept = (trialJobs || 0) < trialServices
    }

    if (!canAccept) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan:plan_id(max_services)')
        .eq('provider_id', activeProId)
        .eq('status', 'active')
        .maybeSingle()

      const maxServices = (subscription as any)?.plan?.max_services
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const { count: monthlyJobs } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', activeProId)
        .gte('accepted_at', startOfMonth.toISOString())
        .neq('status', 'cancelled')

      if (maxServices && (monthlyJobs || 0) < maxServices) {
        canAccept = true
      } else {
        const { data: companyCanAccept } = await supabase.rpc('company_can_accept', { p_provider: activeProId })
        if (companyCanAccept === true) {
          canAccept = true
        } else {
          const { data: creditRow } = await supabase
            .from('service_credits')
            .select('balance')
            .eq('provider_id', activeProId)
            .maybeSingle()

          if ((creditRow?.balance || 0) > 0) {
            const { data: consumed } = await supabase.rpc('consume_service_credit', { p_provider: activeProId })
            canAccept = consumed === true
          }
        }
      }
    }

    if (!canAccept) {
      Alert.alert(
        'Serviços esgotados',
        'O teu trial/plano terminou e não tens créditos. Compra um plano ou carrega créditos para continuares a aceitar pedidos.',
        [
          { text: 'Depois', style: 'cancel' },
          { text: 'Ver planos', onPress: () => router.push('/planos') },
        ]
      )
      return
    }

    const { data: acceptedRequest, error: reqErr } = await supabase
      .from('service_requests')
      .update({
        status: 'accepted',
        target_provider_id: activeProId
      })
      .eq('id', requestId)
      .eq('status', 'open')
      .select('id')

    if (reqErr || !acceptedRequest || acceptedRequest.length === 0) {
      recusadosRef.current.add(requestId)
      setNewRequest(null)
      setPendingJobs(prev => prev.filter(job => job.id !== requestId))
      Alert.alert(
        'Pedido já atribuído',
        'Outro mestre respondeu primeiro. Este pedido já não está disponível.'
      )
      return
    }

    try {
      await supabase.from('request_offers').upsert({
        request_id: requestId,
        provider_id: activeProId,
        status: 'accepted',
        responded_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }, { onConflict: 'request_id,provider_id' })
    } catch (e) {
      console.warn('Registo de oferta aceite:', e)
    }

    // 2. Registar em jobs (o trigger na BD garante um único serviço activo)
    const { data: createdJob, error: jobError } = await supabase
      .from('jobs')
      .upsert({
        request_id: requestId,
        client_id: req?.client_id,
        provider_id: activeProId,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      }, { onConflict: 'request_id' })
      .select('id')
      .maybeSingle()

    if (jobError || !createdJob) {
      const estaOcupado = String(jobError?.message || '').includes('provider_busy')

      // Devolver o pedido ao mercado para não ficar preso num mestre que não o pode atender.
      await supabase
        .from('service_requests')
        .update({ status: 'open', target_provider_id: null })
        .eq('id', requestId)
        .eq('status', 'accepted')
        .eq('target_provider_id', activeProId)

      setNewRequest(null)
      setPendingJobs(prev => prev.filter(job => job.id !== requestId))

      Alert.alert(
        estaOcupado ? 'Já tens um serviço activo' : 'Erro',
        estaOcupado
          ? 'Conclui ou cancela o serviço que já aceitaste antes de aceitar outro pedido.'
          : 'Não foi possível registar o serviço. Tenta novamente.'
      )
      return
    }

    // 3. Atualizar presença com timestamp recente
    if (activeProId) {
      await supabase
        .from('provider_presence')
        .update({ updated_at: new Date().toISOString() })
        .eq('provider_id', activeProId)
    }

    setNewRequest(null)
    setPendingJobs(prev => prev.filter(job => job.id !== requestId))
    setTrabalhosHoje(prev => prev + 1)

    // Navegar para o ecrã de análise do problema e proposta de orçamento!
    router.push({
      pathname: '/trabalho/propor-preco',
      params: {
        jobId: requestId,
        categoriaNome: jobTitle,
        categoriaEmoji: '🔧'
      }
    })
  }

  const recusarTrabalho = async (requestId: string) => {
    recusadosRef.current.add(requestId);

    const activeProId = providerProfile?.profile_id || user?.id
    if (activeProId) {
      try {
        await supabase.from('request_offers').upsert({
          request_id: requestId,
          provider_id: activeProId,
          status: 'declined',
          responded_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        }, { onConflict: 'request_id,provider_id' })
      } catch (e) {
        console.warn('Registo de recusa:', e)
      }
    }

    setNewRequest(null);
    setPendingJobs(prev => prev.filter(job => job.id !== requestId));

    if (Platform.OS !== 'web') {
      Alert.alert('Pedido removido', 'Este pedido deixou de aparecer para ti. Continua disponível para outros mestres.');
    } else {
      console.log('Pedido removido da lista.');
    }
  }

  const toggleOnline = async () => {
    if (!isVerified) {
      Alert.alert(
        'Verificação necessária',
        'O teu cadastro ainda não foi aprovado. Conclui a verificação de identidade para começares a receber pedidos.',
        [
          { text: 'Mais tarde', style: 'cancel' },
          { text: 'Verificar', onPress: () => router.push('/verificacao') },
        ]
      )
      return
    }

    const newValue = !isOnline
    const proId = providerProfile?.profile_id || user?.id

    if (!proId) {
      Alert.alert('Erro', 'Não foi possível identificar o teu perfil de mestre.')
      return
    }

    const deviceId = await getDeviceId()

    if (newValue) {
      const { data: claimed, error } = await supabase.rpc('provider_claim_device', {
        p_provider: proId,
        p_device_id: deviceId,
        p_categories: categoryIds.length ? categoryIds : [2]
      })

      if (error) {
        Alert.alert('Erro', 'Não foi possível ficar online. Tenta novamente.')
        return
      }

      if (claimed !== true) {
        setIsOnline(false)
        Alert.alert(
          'Conta activa noutro dispositivo',
          'Esta conta de mestre já está online noutro dispositivo. Desliga-a nesse dispositivo para poderes ficar online aqui.'
        )
        return
      }

      deviceBlockedRef.current = false
      setIsOnline(true)
    } else {
      await supabase.rpc('provider_release_device', {
        p_provider: proId,
        p_device_id: deviceId
      })
      setIsOnline(false)
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isOnline ? '#0F2D1A' : '#1A1A2E' }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ marginBottom: 24 }}>
        {/* Barra de Perfil do Mestre Sempre Visível */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image
              source={{ uri: (providerProfile?.profiles as any)?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' }}
              style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#F2C94C', backgroundColor: '#334155' }}
            />
            <View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
                {providerProfile?.business_name || (providerProfile?.profiles as any)?.full_name || 'Mestre'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ backgroundColor: '#F2C94C', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#1A1A2E', fontWeight: '900', fontSize: 10 }}>
                    {providerProfile?.categories?.name || 'Mecânico'}
                  </Text>
                </View>
                <Text style={{ color: isOnline ? '#4ADE80' : '#94A3B8', fontSize: 11, fontWeight: '700' }}>
                  {isOnline ? '🟢 Online (Disponível)' : '⚪ Pausa'}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Switch
              value={isOnline}
              onValueChange={toggleOnline}
              trackColor={{ false: '#334155', true: '#22c55e' }}
              thumbColor={isOnline ? '#fff' : '#cbd5e1'}
            />
            <Text style={{ color: '#cbd5e1', fontSize: 9, marginTop: 2, fontWeight: '800' }}>
              {isOnline ? 'ACTIVO' : 'PAUSA'}
            </Text>
            <TouchableOpacity onPress={handleSignOut} activeOpacity={0.8} style={{ marginTop: 6 }}>
              <Text style={{ color: '#FCA5A5', fontSize: 10, fontWeight: '900' }}>SAIR</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.logo}>🔨 Bué de Mestres Pro</Text>

        {/* Acesso aos trabalhos em curso (negociações, deslocações, serviço) */}
        <TouchableOpacity
          onPress={() => router.push('/trabalhos')}
          activeOpacity={0.85}
          style={{
            marginTop: 14,
            backgroundColor: 'rgba(242,201,76,0.12)',
            borderWidth: 1.5,
            borderColor: '#F2C94C',
            borderRadius: 8,
            paddingVertical: 12,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Text style={{ color: '#F2C94C', fontWeight: '900', fontSize: 13 }}>
            📋 OS MEUS TRABALHOS EM CURSO
          </Text>
          <Text style={{ color: '#F2C94C', fontWeight: '900', fontSize: 16 }}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/notificacoes')}
          activeOpacity={0.85}
          style={{
            marginTop: 8,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
            borderRadius: 8,
            paddingVertical: 10,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Text style={{ color: '#F5F0E8', fontWeight: '900', fontSize: 12 }}>🔔 NOTIFICAÇÕES</Text>
          {unreadCount > 0 ? (
            <View style={{ backgroundColor: '#DC2626', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>{unreadCount}</Text>
            </View>
          ) : (
            <Text style={{ color: '#94A3B8', fontWeight: '900', fontSize: 12 }}>—</Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <TouchableOpacity onPress={() => router.push('/planos')} style={styles.quickChip}>
            <Text style={styles.quickChipText}>💳 Planos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/carregar')} style={styles.quickChip}>
            <Text style={styles.quickChipText}>➕ Carregar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/afiliados')} style={styles.quickChip}>
            <Text style={styles.quickChipText}>🤝 Afiliados</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/empresa')} style={styles.quickChip}>
            <Text style={styles.quickChipText}>🏢 Empresa</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/suporte')} style={styles.quickChip}>
            <Text style={styles.quickChipText}>🎧 Apoio</Text>
          </TouchableOpacity>
        </View>

        {/* Seletor rápido de Especialidade / Mestre Registado */}
        {availableProviders.length > 1 && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {availableProviders.map(p => (
              <TouchableOpacity
                key={p.profile_id}
                onPress={() => setProviderProfile(p)}
                style={{
                  backgroundColor: providerProfile?.profile_id === p.profile_id ? '#2563EB' : 'rgba(255,255,255,0.08)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: providerProfile?.profile_id === p.profile_id ? '#60A5FA' : 'rgba(255,255,255,0.1)'
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {p.categories?.name || 'Mestre'}: {p.business_name?.substring(0, 15)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      {sandbox?.active && (
        <View style={styles.sandboxBanner}>
          <Text style={styles.sandboxBannerText}>
            🧪 MODO SANDBOX ATIVO — os serviços custam entre MT {sandbox.min} e MT {sandbox.max}.
          </Text>
        </View>
      )}
      <Modal visible={!!newRequest} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Pedido Disponível</Text>
              <Text style={styles.pulseIndicator}>🟢</Text>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalCategory}>{formatJobTitle(newRequest?.title, newRequest?.category_id)}</Text>
              <Text style={styles.modalDescription}>
                {newRequest?.description || 'O cliente precisa da sua ajuda nesta área o mais rápido possível.'}
              </Text>
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceText}>📍 Na sua área</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnRecusar} onPress={() => newRequest?.id && recusarTrabalho(newRequest.id)}>
                <Text style={styles.btnRecusarText}>Recusar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAceitar} onPress={() => aceitarTrabalho(newRequest)}>
                <Text style={styles.btnAceitarText}>ACEITAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {providerProfile && !isVerified && (
        <TouchableOpacity
          style={styles.verifyBanner}
          onPress={() => router.push('/verificacao')}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.verifyBannerTitle}>
              {providerProfile.verification === 'rejected' ? 'Verificação rejeitada' : 'Cadastro em verificação'}
            </Text>
            <Text style={styles.verifyBannerHint}>
              {providerProfile.verification === 'rejected'
                ? 'Corrige os dados e submete novamente para poderes receber pedidos.'
                : 'Só recebes pedidos depois de o teu cadastro ser aprovado. Toca para concluir ou acompanhar.'}
            </Text>
          </View>
          <Text style={styles.verifyBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>Estado</Text>
            <Text style={[styles.statusValue, { color: isOnline ? '#4ADE80' : '#9CA3AF' }]}>
              {isOnline ? '● Online' : '○ Offline'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={toggleOnline}
            trackColor={{ false: '#374151', true: '#166534' }}
            thumbColor={isOnline ? '#4ADE80' : '#9CA3AF'}
          />
        </View>

        {isOnline && (
          <Text style={styles.onlineHint}>
            A receber pedidos na tua área. Mantém o GPS activo.
          </Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{trabalhosHoje}</Text>
          <Text style={styles.statLabel}>Hoje</Text>
        </View>
        <TouchableOpacity style={styles.statBox} onPress={() => router.push('/carteira')} activeOpacity={0.8}>
          <Text style={styles.statNumber}>MT {walletBalance.toLocaleString('pt-MZ')}</Text>
          <Text style={styles.statLabel}>Ganhos ›</Text>
        </TouchableOpacity>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>—</Text>
          <Text style={styles.statLabel}>Nota</Text>
        </View>
      </View>

      <TouchableOpacity
        style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}
        onPress={() => router.push('/carteira')}
        activeOpacity={0.85}
      >
        <View style={styles.financeBox}>
          <Text style={styles.financeLabel}>DEVIDO</Text>
          <Text style={[styles.financeValue, { color: '#F2C94C' }]}>MT {financeSummary.devido.toLocaleString('pt-MZ')}</Text>
        </View>
        <View style={styles.financeBox}>
          <Text style={styles.financeLabel}>PAGO</Text>
          <Text style={[styles.financeValue, { color: '#4ADE80' }]}>MT {financeSummary.pago.toLocaleString('pt-MZ')}</Text>
        </View>
        <View style={styles.financeBox}>
          <Text style={styles.financeLabel}>FATURAÇÃO</Text>
          <Text style={styles.financeValue}>MT {financeSummary.faturacao.toLocaleString('pt-MZ')}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.escrowCard}
        onPress={() => router.push('/carteira')}
        activeOpacity={0.85}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.escrowLabel}>🔒 RETIDO EM ESCROW</Text>
          <Text style={styles.escrowHint}>Libertado após o cliente confirmar a conclusão.</Text>
        </View>
        <Text style={styles.escrowValue}>MT {heldAmount.toLocaleString('pt-MZ')}</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 24 }}>
        <Text style={{ color: '#9CA3AF', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 }}>
          Pedidos Pendentes ({pendingJobs.length})
        </Text>
        
        {pendingJobs.length === 0 ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 24, borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: '#6B7280', fontSize: 16 }}>Nenhum pedido pendente para esta especialidade.</Text>
          </View>
        ) : (
          pendingJobs.map(job => (
            <View key={job.id} style={{ backgroundColor: '#1E293B', padding: 16, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: 'bold' }}>
                  {formatJobTitle(job.title || job.problem_description, job.category_id)}
                </Text>
                <View style={{ backgroundColor: 'rgba(242,201,76,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#F2C94C', fontSize: 11, fontWeight: 'bold' }}>URGENTE</Text>
                </View>
              </View>

              {job.description && (
                <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8, lineHeight: 18 }}>
                  {job.description}
                </Text>
              )}

              {(job.location_note || job.reference_point) && (
                <Text style={{ color: '#38BDF8', fontSize: 12, marginBottom: 12 }}>
                  📍 Ref: {job.location_note || job.reference_point}
                </Text>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#451A1A', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#7F1D1D' }}
                  onPress={() => recusarTrabalho(job.id)}
                >
                  <Text style={{ color: '#FCA5A5', fontWeight: 'bold' }}>RECUSAR</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 2, backgroundColor: '#4ADE80', padding: 12, borderRadius: 6, alignItems: 'center' }}
                  onPress={() => aceitarTrabalho(job)}
                >
                  <Text style={{ color: '#0F2D1A', fontWeight: 'bold' }}>ACEITAR E PARTIR →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  logo: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F5F0E8',
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  sandboxBanner: {
    backgroundColor: 'rgba(242,201,76,0.18)',
    borderWidth: 1.5,
    borderColor: '#F2C94C',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  sandboxBannerText: { color: '#F2C94C', fontWeight: '900', fontSize: 11, textAlign: 'center' },
  quickChip: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  quickChipText: { color: '#F5F0E8', fontWeight: '800', fontSize: 11 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pulseIndicator: {
    fontSize: 12,
  },
  modalBody: {
    marginBottom: 28,
  },
  modalCategory: {
    color: '#F5F0E8',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalDescription: {
    color: '#D1D5DB',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  distanceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242, 201, 76, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  distanceText: {
    color: '#F2C94C',
    fontSize: 13,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnRecusar: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  btnRecusarText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnAceitar: {
    flex: 2,
    backgroundColor: '#4ADE80',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAceitarText: {
    color: '#0F2D1A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(242,201,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.4)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  verifyBannerTitle: { color: '#F2C94C', fontSize: 15, fontWeight: '800' },
  verifyBannerHint: { color: '#E5E7EB', fontSize: 12, marginTop: 4, lineHeight: 17 },
  verifyBannerArrow: { color: '#F2C94C', fontSize: 28, fontWeight: '300' },
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  onlineHint: {
    marginTop: 12,
    color: '#4ADE80',
    fontSize: 13,
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statNumber: {
    color: '#F2C94C',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  financeBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  financeLabel: { color: '#9CA3AF', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginBottom: 3 },
  financeValue: { color: '#F5F0E8', fontSize: 13, fontWeight: '900' },
  escrowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(242,201,76,0.12)',
    borderWidth: 1.5,
    borderColor: '#F2C94C',
    borderRadius: 8,
    padding: 14,
    marginTop: 10,
  },
  escrowLabel: { color: '#F2C94C', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  escrowHint: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },
  escrowValue: { color: '#F2C94C', fontWeight: '900', fontSize: 20 },
  btnVerificacao: {
    backgroundColor: '#F2C94C',
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A2E',
  },
  btnVerificacaoText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
