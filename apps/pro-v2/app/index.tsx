import { colors, radius, shadows, formatMoney } from '@/lib/theme'
import { Avatar, BrandMark, Button, IconButton, SectionHeader, Stat } from '@/components/v2'
import { SafeAreaView } from 'react-native'
import { View, Text, StyleSheet, Switch, TouchableOpacity, Platform, Modal, TextInput, ActivityIndicator, Image, ScrollView, StatusBar } from 'react-native'
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
  const [earningsBalance, setEarningsBalance] = useState<number>(0)
  const [platformDebt, setPlatformDebt] = useState<number>(0)
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
        supabase.from('wallets').select('balance, earnings_balance, platform_debt').eq('profile_id', proId).maybeSingle(),
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
      setEarningsBalance(Number(data?.earnings_balance || 0))
      setPlatformDebt(Number(data?.platform_debt || 0))
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
          'Não podes aceitar pedidos',
          'Carrega a tua carteira (saldo mínimo) ou aguarda alguns minutos se estiveres em cooldown.',
          [
            { text: 'Depois', style: 'cancel' },
            { text: 'Carregar saldo', onPress: () => router.push('/carregar') },
          ]
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

    // Preferir accept_offer quando o despacho já criou uma oferta (marca active_job_id e cancela rivais).
    const { data: ofertaActiva } = await supabase
      .from('request_offers')
      .select('id')
      .eq('request_id', requestId)
      .eq('provider_id', activeProId)
      .in('status', ['sent', 'viewed'])
      .gt('expires_at', new Date().toISOString())
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ofertaActiva?.id) {
      const { data: jobIdFromOffer, error: offerErr } = await supabase.rpc('accept_offer', {
        p_offer: ofertaActiva.id,
        p_eta_s: 480,
      })

      if (!offerErr && jobIdFromOffer) {
        setNewRequest(null)
        setPendingJobs(prev => prev.filter(job => job.id !== requestId))
        setTrabalhosHoje(prev => prev + 1)
        router.push({
          pathname: '/trabalho/propor-preco',
          params: {
            jobId: String(jobIdFromOffer),
            categoriaNome: jobTitle,
            categoriaEmoji: '🔧',
          },
        })
        return
      }

      const offerMsg = String(offerErr?.message || '')
      if (offerMsg.includes('request_taken') || offerMsg.includes('offer_unavailable')) {
        recusadosRef.current.add(requestId)
        setNewRequest(null)
        setPendingJobs(prev => prev.filter(job => job.id !== requestId))
        Alert.alert(
          'Pedido já atribuído',
          'Outro mestre respondeu primeiro. Este pedido já não está disponível.'
        )
        return
      }
      if (offerMsg.includes('provider_busy')) {
        Alert.alert(
          'Já tens um serviço activo',
          'Conclui ou cancela o serviço que já aceitaste antes de aceitar outro pedido.'
        )
        return
      }
      // Se a RPC falhar por outro motivo, cai no fluxo manual abaixo.
      console.warn('accept_offer falhou, a usar fluxo manual:', offerErr)
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
        jobId: createdJob.id || requestId,
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
  const visibleJobs = pendingJobs.filter(
    (job) => !newRequest || job.id !== newRequest.id
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <BrandMark size={38} />
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName}>Bué de Mestres Pro</Text>
              <Text style={styles.brandTag}>A tua oficina digital</Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <IconButton
              icon="🔔"
              label="Notificações"
              badge={unreadCount}
              onPress={() => router.push('/notificacoes')}
            />
            <TouchableOpacity
              onPress={() => router.push('/perfil')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Abrir conta"
            >
              <Avatar
                uri={(providerProfile?.profiles as any)?.avatar_url}
                name={providerProfile?.business_name || (providerProfile?.profiles as any)?.full_name}
                size={42}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.onlineCard}>
          <View style={styles.onlineTop}>
            <View style={styles.onlineStatus}>
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: isOnline ? '#4ADE80' : '#94A3B8' },
                ]}
              />
              <Text style={styles.onlineStatusText}>
                {isOnline ? 'Online · a receber pedidos' : 'Em pausa'}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={toggleOnline}
              trackColor={{ false: '#334155', true: '#22C55E' }}
              thumbColor={colors.white}
            />
          </View>
          <Text style={styles.onlineTitle}>
            {isOnline ? 'Estás disponível para trabalhar' : 'Fica online para receber pedidos'}
          </Text>
          <Text style={styles.onlineText}>
            {isOnline
              ? 'Mantém o GPS activo. Os pedidos da tua área aparecem aqui.'
              : 'Activa o modo online quando estiveres pronto para aceitar serviços.'}
          </Text>
          {providerProfile?.categories?.name ? (
            <View style={styles.onlineCategory}>
              <Text style={styles.onlineCategoryText}>{providerProfile.categories.name}</Text>
            </View>
          ) : null}
        </View>

        {sandbox?.active && (
          <View style={styles.sandbox}>
            <Text style={styles.sandboxText}>
              🧪 Sandbox · serviços entre {formatMoney(sandbox.min)} e{' '}
              {formatMoney(sandbox.max)}
            </Text>
          </View>
        )}

        {providerProfile && !isVerified && (
          <TouchableOpacity
            style={styles.verifyCard}
            onPress={() => router.push('/verificacao')}
            activeOpacity={0.85}
          >
            <View style={styles.verifyIcon}>
              <Text style={{ fontSize: 20 }}>🛡️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>
                {providerProfile.verification === 'rejected'
                  ? 'Verificação rejeitada'
                  : 'Conclui a tua verificação'}
              </Text>
              <Text style={styles.verifyText}>
                {providerProfile.verification === 'rejected'
                  ? 'Corrige os dados para voltares a receber pedidos.'
                  : 'Só recebes pedidos depois de aprovares a identidade.'}
              </Text>
            </View>
            <Text style={styles.verifyArrow}>→</Text>
          </TouchableOpacity>
        )}

        {newRequest && (
          <View style={styles.requestCard}>
            <View style={styles.requestTop}>
              <View style={styles.requestPill}>
                <View style={styles.requestDot} />
                <Text style={styles.requestPillText}>NOVO PEDIDO</Text>
              </View>
              <Text style={styles.requestTime}>Agora</Text>
            </View>
            <Text style={styles.requestTitle}>
              {formatJobTitle(newRequest?.title, newRequest?.category_id)}
            </Text>
            <Text style={styles.requestText} numberOfLines={3}>
              {newRequest?.description ||
                'O cliente precisa da tua ajuda nesta área o mais rápido possível.'}
            </Text>
            <View style={styles.requestMeta}>
              <Text style={styles.requestMetaText}>📍 Na tua área</Text>
            </View>
            <View style={styles.requestActions}>
              <Button
                label="Recusar"
                variant="ghost"
                onPress={() => newRequest?.id && recusarTrabalho(newRequest.id)}
                style={{ flex: 1 }}
              />
              <Button
                label="Aceitar pedido"
                onPress={() => aceitarTrabalho(newRequest)}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        )}

        {visibleJobs.length > 0 && (
          <>
            <SectionHeader
              title="Pedidos na tua área"
              actionLabel="Ver trabalhos"
              onAction={() => router.push('/trabalhos')}
            />
            {visibleJobs.slice(0, 3).map((job) => (
              <View key={job.id} style={styles.jobCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobTitle}>
                    {formatJobTitle(job.title, job.category_id)}
                  </Text>
                  <Text style={styles.jobText} numberOfLines={2}>
                    {job.description || 'Pedido de serviço na tua área.'}
                  </Text>
                </View>
                <View style={styles.jobActions}>
                  <TouchableOpacity
                    onPress={() => recusarTrabalho(job.id)}
                    style={styles.jobDecline}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.jobDeclineText}>×</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => aceitarTrabalho(job)}
                    style={styles.jobAccept}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.jobAcceptText}>Aceitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <SectionHeader title="Resumo" />
        <View style={styles.statsGrid}>
          <View style={styles.statHalf}>
            <Stat label="Trabalhos hoje" value={String(trabalhosHoje)} />
          </View>
          <View style={styles.statHalf}>
            <Stat label="Ganhos" value={formatMoney(earningsBalance)} tone="green" />
          </View>
          <View style={styles.statHalf}>
            <Stat label="Saldo de operação" value={formatMoney(walletBalance)} />
          </View>
          <View style={styles.statHalf}>
            <Stat
              label="Dívida à plataforma"
              value={formatMoney(platformDebt)}
              tone={platformDebt > 0 ? 'red' : 'default'}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.financeCard}
          onPress={() => router.push('/carteira')}
          activeOpacity={0.85}
        >
          <View style={styles.financeTop}>
            <Text style={styles.financeTitle}>Financeiro</Text>
            <Text style={styles.financeArrow}>→</Text>
          </View>
          <View style={styles.financeRow}>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>DEVIDO</Text>
              <Text style={[styles.financeValue, { color: '#8A5A00' }]}>
                {formatMoney(financeSummary.devido)}
              </Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>PAGO</Text>
              <Text style={[styles.financeValue, { color: colors.green }]}>
                {formatMoney(financeSummary.pago)}
              </Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>FATURAÇÃO</Text>
              <Text style={styles.financeValue}>
                {formatMoney(financeSummary.faturacao)}
              </Text>
            </View>
          </View>
          {heldAmount > 0 && (
            <Text style={styles.heldText}>
              🔒 {formatMoney(heldAmount)} retidos em serviços em curso
            </Text>
          )}
        </TouchableOpacity>

        <SectionHeader title="Atalhos" />
        <View style={styles.actionsGrid}>
          {[
            { icon: '▤', label: 'Trabalhos', href: '/trabalhos' },
            { icon: '◫', label: 'Carteira', href: '/carteira' },
            { icon: '＋', label: 'Carregar', href: '/carregar' },
            { icon: '💳', label: 'Planos', href: '/planos' },
            { icon: '🤝', label: 'Afiliados', href: '/afiliados' },
            { icon: '🏢', label: 'Empresa', href: '/empresa' },
            { icon: '🎧', label: 'Apoio', href: '/suporte' },
            { icon: '🪪', label: 'Dados de pagamento', href: '/dados-pagamento' },
          ].map((action) => (
            <TouchableOpacity
              key={action.href}
              style={styles.actionCard}
              onPress={() => router.push(action.href as any)}
              activeOpacity={0.85}
            >
              <View style={styles.actionIcon}>
                <Text style={{ fontSize: 18 }}>{action.icon}</Text>
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {availableProviders.length > 1 && (
          <View style={styles.selectorCard}>
            <Text style={styles.selectorTitle}>Conta de mestre</Text>
            <View style={styles.selectorRow}>
              {availableProviders.map((p) => (
                <TouchableOpacity
                  key={p.profile_id}
                  onPress={() => setProviderProfile(p)}
                  style={[
                    styles.selectorChip,
                    providerProfile?.profile_id === p.profile_id && styles.selectorChipActive,
                  ]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.selectorChipText,
                      providerProfile?.profile_id === p.profile_id && {
                        color: colors.white,
                      },
                    ]}
                  >
                    {p.categories?.name || 'Mestre'}: {p.business_name?.substring(0, 15)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 26 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  brandName: { fontSize: 17, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 },
  brandTag: { fontSize: 10, fontWeight: '600', color: colors.muted, marginTop: 2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  onlineCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.navy,
    ...shadows.card,
  },
  onlineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  onlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  onlineDot: { width: 9, height: 9, borderRadius: 5 },
  onlineStatusText: { color: '#D9E4F3', fontSize: 11, fontWeight: '800' },
  onlineTitle: {
    marginTop: 12,
    color: colors.white,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  onlineText: {
    marginTop: 5,
    color: '#C8D3E6',
    fontSize: 12,
    lineHeight: 17,
  },
  onlineCategory: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,198,26,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,198,26,0.35)',
  },
  onlineCategoryText: { color: colors.yellow, fontSize: 10, fontWeight: '900' },
  sandbox: {
    marginBottom: 14,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: '#FFF4CC',
    borderWidth: 1,
    borderColor: '#F2D36B',
  },
  sandboxText: { fontSize: 11, fontWeight: '800', color: '#6B5300' },
  verifyCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#F2D36B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verifyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF4CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTitle: { fontSize: 12, fontWeight: '900', color: colors.ink },
  verifyText: { fontSize: 10, color: colors.muted, lineHeight: 14, marginTop: 2 },
  verifyArrow: { fontSize: 18, color: colors.blue, fontWeight: '900' },
  requestCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.yellow,
    ...shadows.card,
  },
  requestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  requestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: '#E6F8EF',
  },
  requestDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  requestPillText: { fontSize: 9, fontWeight: '900', color: colors.green },
  requestTime: { fontSize: 10, fontWeight: '700', color: colors.muted },
  requestTitle: { fontSize: 18, fontWeight: '900', color: colors.ink },
  requestText: { marginTop: 5, fontSize: 12, lineHeight: 17, color: colors.muted },
  requestMeta: { marginTop: 9 },
  requestMetaText: { fontSize: 11, fontWeight: '800', color: colors.blue },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  jobCard: {
    marginBottom: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  jobTitle: { fontSize: 12, fontWeight: '900', color: colors.ink },
  jobText: { marginTop: 3, fontSize: 10, lineHeight: 14, color: colors.muted },
  jobActions: { alignItems: 'center', gap: 5 },
  jobDecline: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobDeclineText: { fontSize: 16, color: colors.muted, fontWeight: '900' },
  jobAccept: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.soft,
  },
  jobAcceptText: { fontSize: 9, fontWeight: '900', color: colors.blue },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 16,
  },
  statHalf: { width: '48.5%', flexGrow: 1 },
  financeCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  financeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  financeTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  financeArrow: { fontSize: 16, color: colors.muted, fontWeight: '900' },
  financeRow: { flexDirection: 'row', gap: 8 },
  financeItem: {
    flex: 1,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  financeLabel: { fontSize: 8, fontWeight: '900', color: colors.muted, letterSpacing: 0.6 },
  financeValue: { marginTop: 3, fontSize: 12, fontWeight: '900', color: colors.ink },
  heldText: { marginTop: 9, fontSize: 10, fontWeight: '700', color: colors.muted },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 9,
    marginBottom: 18,
  },
  actionCard: {
    width: '48.5%',
    minHeight: 64,
    padding: 11,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { flex: 1, fontSize: 11, fontWeight: '800', color: colors.ink },
  selectorCard: {
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  selectorTitle: { fontSize: 14, fontWeight: '900', color: colors.ink, marginBottom: 9 },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  selectorChip: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  selectorChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  selectorChipText: { fontSize: 10, fontWeight: '800', color: colors.ink },
})
