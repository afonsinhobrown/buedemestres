import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, ScrollView, Linking, Platform } from 'react-native'
import { Alert } from '../../lib/alertCompat'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/useAuthStore'
import { loadSandboxSettings } from '../../lib/sandbox'

// Base do servidor que fala com a PaySuite (Web). No browser usamos a mesma
// origem; nas apps nativas apontamos para a API pública.
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'web' ? '' : 'https://buedemestres.vercel.app')

export default function PropostaPrecoScreen() {
  const params = useLocalSearchParams<{
    jobId: string
    mestreNome?: string
    categoriaEmoji?: string
  }>()
  const user = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(true)
  const [proposalData, setProposalData] = useState<any>(null)
  const [lines, setLines] = useState<{ descricao: string; valor: number }[]>([
    { descricao: 'Diagnóstico e mão de obra', valor: 800 },
    { descricao: 'Taxa de deslocação', valor: 150 }
  ])
  const [total, setTotal] = useState<number>(950)
  const [actualJobId, setActualJobId] = useState<string>(params.jobId || '')

  // Estados de Negociação ("Concordo", "Não concordo", "Está puxado")
  const [pagamentoFeito, setPagamentoFeito] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState('Acordo Fechado no Sistema!')
  const [subSucesso, setSubSucesso] = useState('O valor está retido na plataforma (Escrow) e só será libertado ao mestre quando confirmares o fim do serviço.')
  
  const [modalPuxadoVisivel, setModalPuxadoVisivel] = useState(false)
  const [modalNaoConcordoVisivel, setModalNaoConcordoVisivel] = useState(false)
  const [contraValor, setContraValor] = useState('')
  const [contraNota, setContraNota] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Autoria da negociação: quem deve responder à última proposta
  const [aguardandoMestre, setAguardandoMestre] = useState(false)
  const [semOrcamentoMestre, setSemOrcamentoMestre] = useState(false)
  const [contraDeCliente, setContraDeCliente] = useState(0)
  const [turnoExpiraEm, setTurnoExpiraEm] = useState<number | null>(null)
  const [segundosTurno, setSegundosTurno] = useState<number | null>(null)
  const [negociacaoExpirada, setNegociacaoExpirada] = useState(false)
  const [mensagemMestre, setMensagemMestre] = useState<string | null>(null)
  const [sandbox, setSandbox] = useState<{ active: boolean; min: number; max: number }>({
    active: true,
    min: 1,
    max: 10
  })

  // Pagamento (PaySuite): escolha de método + estado pendente
  const [modalPagamentoVisivel, setModalPagamentoVisivel] = useState(false)
  const [pagamentoPendente, setPagamentoPendente] = useState<{ url: string | null; reference: string } | null>(null)
  const [verificandoPagamento, setVerificandoPagamento] = useState(false)
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let mounted = true
    const carregarSandbox = async () => {
      try {
        const settings = await loadSandboxSettings()
        if (mounted) setSandbox(settings)
      } catch {
        // mantém o default
      }
    }
    carregarSandbox()
    return () => {
      mounted = false
    }
  }, [])

  // Relógio do turno (conta decrescente por segundo)
  useEffect(() => {
    if (!turnoExpiraEm) {
      setSegundosTurno(null)
      return
    }
    const tick = () => setSegundosTurno(Math.max(0, Math.round((turnoExpiraEm - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [turnoExpiraEm])

  useEffect(() => {
    async function carregarPropostaReal() {
      if (!params.jobId) {
        setLoading(false)
        return
      }

      try {
        const { data: jobMap } = await supabase
          .from('jobs')
          .select('id, request_id, status, agreed_amount, cancel_reason, turn_owner, turn_expires_at, negotiation_rounds, client_id, provider_id')
          .or(`id.eq.${params.jobId},request_id.eq.${params.jobId}`)
          .maybeSingle()

        const resolvedJobId = jobMap?.id || params.jobId

        const { data: props } = await supabase
          .from('job_price_proposals')
          .select('*')
          .or(`job_id.eq.${resolvedJobId},job_id.eq.${params.jobId}`)
          .order('created_at', { ascending: false })

        const lista: any[] = props || []
        const providerId = jobMap?.provider_id
        const clientId = jobMap?.client_id
        const propostaMaster = lista.find((p) => p.proposed_by === providerId)
        const ultima = lista[0]
        const ultimaEhDoCliente = !!ultima && (
          ultima.proposed_by === clientId ||
          (ultima.description && ultima.description.includes('[ESTÁ PUXADO'))
        )

        // Preço de referência = última proposta feita pelo mestre
        if (propostaMaster) {
          setProposalData(propostaMaster)
          setTotal(Number(propostaMaster.amount))
          setActualJobId(propostaMaster.job_id)
          try {
            const parsed = JSON.parse(propostaMaster.description)
            const parsedLines = Array.isArray(parsed) ? parsed : parsed?.lines
            if (Array.isArray(parsedLines) && parsedLines.length > 0) {
              setLines(parsedLines.map((l: any) => ({
                descricao: l.description || l.descricao || 'Serviço',
                valor: parseFloat(l.price ?? l.valor) || 0
              })))
            }
            setMensagemMestre(!Array.isArray(parsed) && parsed?.message ? String(parsed.message) : null)
          } catch {
            setLines([{ descricao: propostaMaster.description || 'Orçamento do Mestre', valor: Number(propostaMaster.amount) }])
            setMensagemMestre(null)
          }
        } else if (!ultimaEhDoCliente) {
          const { data: req } = await supabase
            .from('service_requests')
            .select('budget_max, title')
            .eq('id', params.jobId)
            .maybeSingle()

          if (req?.budget_max) {
            setTotal(Number(req.budget_max))
            setLines([{ descricao: req.title || 'Serviço solicitado', valor: Number(req.budget_max) }])
          }
        }

        // Se a última proposta é do cliente, o mestre é quem tem de aceitar/recusar.
        const aguardar = ultimaEhDoCliente && ultima.status !== 'accepted'
        setAguardandoMestre(aguardar)
        setContraDeCliente(aguardar ? Number(ultima.amount) : 0)
        setSemOrcamentoMestre(!propostaMaster && !aguardar)

        // Relógio do turno actual e deteção de expiração
        setTurnoExpiraEm(jobMap?.turn_expires_at ? new Date(jobMap.turn_expires_at).getTime() : null)
        setNegociacaoExpirada(
          jobMap?.status === 'cancelled' && String(jobMap?.cancel_reason || '').startsWith('expirado')
        )

        // Se o mestre aceitou e o pagamento já foi retido, mostrar sucesso
        if (jobMap?.status === 'price_agreed' || jobMap?.status === 'in_service') {
          const valorFinal = Number(jobMap.agreed_amount || (ultima?.amount) || 0)
          setMensagemSucesso('Acordo Fechado no Sistema!')
          setSubSucesso(`MT ${valorFinal.toLocaleString('pt-MZ')} retido em segurança (Escrow). O mestre já foi notificado e pode iniciar o trabalho.`)
          setPagamentoFeito(true)
        }
      } catch (err) {
        console.warn('Erro ao carregar proposta:', err)
      } finally {
        setLoading(false)
      }
    }

    carregarPropostaReal()
    // Fecha negociações vencidas (o cron também o faz; aqui é imediato)
    supabase.rpc('expire_stale_negotiations').then(() => {}, () => {})
    const pollInterval = setInterval(carregarPropostaReal, 2500)

    const channel = supabase
      .channel(`client_prop_${params.jobId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_price_proposals' },
        () => carregarPropostaReal()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => carregarPropostaReal()
      )
      .subscribe()

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [params.jobId])

  // 1. OPÇÃO: "CONCORDO" — processa o pagamento via PaySuite
  //    Só marca como retido depois de a PaySuite confirmar (polling).
  const verificarPagamento = (target: string) => {
    if (checkTimerRef.current) clearInterval(checkTimerRef.current)
    setVerificandoPagamento(true)
    let tries = 0
    const timer = setInterval(async () => {
      tries += 1
      try {
        const r = await fetch(`${API_BASE}/api/payments/status?jobId=${encodeURIComponent(target)}`)
        const d = await r.json().catch(() => ({}))
        if (d?.paid) {
          clearInterval(timer)
          checkTimerRef.current = null
          setVerificandoPagamento(false)
          if (proposalData?.id) {
            await supabase.from('job_price_proposals').update({ status: 'accepted' }).eq('id', proposalData.id)
          }
          setMensagemSucesso('Pagamento Confirmado e Retido!')
          setSubSucesso(`MT ${total.toLocaleString('pt-MZ')} retido em segurança (Escrow). O mestre já foi notificado e pode iniciar o trabalho.`)
          setPagamentoFeito(true)
          setPagamentoPendente(null)
        } else if (d?.failed) {
          clearInterval(timer)
          checkTimerRef.current = null
          setVerificandoPagamento(false)
          setPagamentoPendente(null)
          Alert.alert('Pagamento não concluído', 'O pagamento foi recusado ou cancelado. Tenta novamente.')
        }
      } catch {
        // rede instável — continua a tentar
      }
      if (tries > 120) {
        clearInterval(timer)
        checkTimerRef.current = null
        setVerificandoPagamento(false)
      }
    }, 3000)
    checkTimerRef.current = timer
  }

  useEffect(() => {
    return () => {
      if (checkTimerRef.current) clearInterval(checkTimerRef.current)
    }
  }, [])

  // Ao voltar da página de pagamento (nova aba/janela), verificar já o estado.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const aoVoltar = () => {
      if (document.visibilityState === 'visible' && pagamentoPendente) {
        verificarPagamento(actualJobId || params.jobId)
      }
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
    }
  }, [pagamentoPendente, actualJobId, params.jobId])

  const handleConcordo = async (method: 'mpesa' | 'emola' | 'card') => {
    try {
      setIsSubmitting(true)
      const target = actualJobId || params.jobId

      const res = await fetch(`${API_BASE}/api/payments/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: target, amount: total, method })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Não foi possível iniciar o pagamento.')
      }

      setModalPagamentoVisivel(false)
      setPagamentoPendente({ url: data.checkoutUrl ?? null, reference: data.reference })

      if (data.checkoutUrl) {
        try { await Linking.openURL(data.checkoutUrl) } catch { /* web pode bloquear */ }
      }

      verificarPagamento(target)
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível iniciar o pagamento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelarPagamentoPendente = async () => {
    const target = actualJobId || params.jobId
    try {
      await fetch(`${API_BASE}/api/payments/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: target })
      })
    } catch {
      // O estado local é limpo na mesma; o mestre volta a "a processar" na próxima tentativa
    }
    setPagamentoPendente(null)
  }

  // 2. OPÇÃO: "ESTÁ PUXADO" (Negociação / Contra-proposta)
  const handleEnviarPuxado = async () => {
    if (!contraValor || parseFloat(contraValor) <= 0) {
      Alert.alert('Valor', 'Indica o valor que pretendes pagar.')
      return
    }

    try {
      setIsSubmitting(true)
      const target = actualJobId || params.jobId
      const counterMt = parseFloat(contraValor)
      const notaFinal = `[ESTÁ PUXADO - CONTRA-PROPOSTA]: MT ${counterMt}${contraNota ? ` ("${contraNota}")` : ''}`

      // 1. Obter o job real (ou criá-lo) para mapear ambos os IDs
      let { data: job } = await supabase
        .from('jobs')
        .select('id, request_id, provider_id, client_id')
        .or(`id.eq.${target},request_id.eq.${target}`)
        .maybeSingle()

      if (!job) {
        const { data: req } = await supabase
          .from('service_requests')
          .select('id, client_id, target_provider_id')
          .eq('id', target)
          .maybeSingle()

        const { data: createdJob } = await supabase
          .from('jobs')
          .upsert({
            request_id: req?.id || target,
            client_id: req?.client_id,
            provider_id: req?.target_provider_id,
            status: 'puxado',
            price_estimate_min: counterMt
          }, { onConflict: 'request_id' })
          .select('id, request_id, provider_id, client_id')
          .single()

        if (createdJob) job = createdJob
      }

      const jId = job?.id || target
      const rId = job?.request_id || target
      const clientAuthor = job?.client_id || user?.id

      if (!clientAuthor) {
        Alert.alert('Sessão', 'Precisas de entrar na tua conta para negociar.')
        return
      }

      // 1b. Validar rondas e passar o turno ao mestre (reinicia o relógio)
      const { error: turnErr } = await supabase.rpc('set_negotiation_turn', {
        p_job: jId,
        p_owner: 'provider',
        p_is_counter: true
      })
      if (turnErr) {
        if (String(turnErr.message).includes('max_rounds_reached')) {
          Alert.alert(
            'Limite de negociação',
            'Atingiste o número máximo de contra-propostas para este pedido. Concorda com o valor ou cancela.'
          )
          setIsSubmitting(false)
          return
        }
        console.warn('set_negotiation_turn:', turnErr.message)
      }

      // 2. Registar em job_price_proposals com amount da contra-proposta
      //    (cria uma NOVA linha — nunca alterar a proposta original do mestre,
      //     senão perde-se a autoria e ninguém sabe quem deve responder)
      await supabase.from('job_price_proposals').insert({
        job_id: jId,
        proposed_by: clientAuthor,
        amount: counterMt,
        description: notaFinal,
        status: 'pending'
      })

      // 3. Actualizar jobs com status 'puxado' e price_estimate_min
      await supabase
        .from('jobs')
        .update({
          status: 'puxado',
          price_estimate_min: counterMt,
          updated_at: new Date().toISOString()
        })
        .or(`id.eq.${jId},request_id.eq.${rId}`)

      // 4. Actualizar service_requests com status 'puxado' e budget_max
      await supabase
        .from('service_requests')
        .update({
          status: 'puxado',
          budget_max: counterMt,
          updated_at: new Date().toISOString()
        })
        .or(`id.eq.${rId},id.eq.${jId}`)

      // 5. Inserir notificação para o mestre
      const proId = job?.provider_id
      if (proId) {
        try {
        await supabase.from('notifications').insert({
          profile_id: proId,
          type: 'contra_proposta',
          title: 'Contra-proposta Recebida ("Está Puxado")',
          body: `O cliente propôs o valor de MT ${counterMt}.`,
          data: {
            jobId: jId,
            requestId: rId,
            amount: counterMt,
            nota: contraNota
          }
        })
      } catch (notifErr) {
        console.warn('Erro ao inserir notificação para mestre:', notifErr)
      }
      }

      setModalPuxadoVisivel(false)
      setAguardandoMestre(true)
      setContraDeCliente(counterMt)
      setSemOrcamentoMestre(false)
    } catch (err: any) {
      console.error('Erro ao enviar contra-proposta:', err)
      Alert.alert('Erro', err.message || 'Erro ao enviar negociação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. OPÇÃO: RESOLUÇÃO DE PROBLEMA DIFERENTE (Liquidar apenas deslocação/diagnóstico)
  const handlePagarApenasDeslocacao = async () => {
    try {
      setIsSubmitting(true)
      const target = actualJobId || params.jobId
      const taxaDeslocacao = 250

      if (proposalData?.id) {
        await supabase
          .from('job_price_proposals')
          .update({
            amount: taxaDeslocacao,
            description: 'Taxa de Deslocação e Diagnóstico Presencial (Problema diferente do descrito)',
            status: 'accepted'
          })
          .eq('id', proposalData.id)
      }

      await supabase
        .from('jobs')
        .update({
          status: 'completed',
          agreed_amount: taxaDeslocacao
        })
        .or(`id.eq.${target},request_id.eq.${target}`)

      await supabase
        .from('service_requests')
        .update({
          status: 'completed',
          budget_max: taxaDeslocacao
        })
        .or(`id.eq.${target}`)

      await supabase.rpc('close_negotiation', { p_job: target })

      setModalNaoConcordoVisivel(false)
      setTotal(taxaDeslocacao)
      setMensagemSucesso('Taxa de Diagnóstico Liquidada')
      setSubSucesso('Pagaste apenas MT 250 pela deslocação e inspecção técnica do mestre no terreno. O pedido foi encerrado com sucesso.')
      setPagamentoFeito(true)
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Erro ao liquidar taxa de deslocação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelarSemCustos = async () => {
    const target = actualJobId || params.jobId
    if (proposalData?.id) {
      await supabase
        .from('job_price_proposals')
        .update({ status: 'rejected' })
        .eq('id', proposalData.id)
    }
    // Estado terminal: rejeitado pelo cliente, sem turno pendente
    await supabase
      .from('jobs')
      .update({ status: 'cancelled', cancel_reason: 'rejeitado_cliente', updated_at: new Date().toISOString() })
      .or(`id.eq.${target},request_id.eq.${target}`)
    await supabase.rpc('close_negotiation', { p_job: target })
    setModalNaoConcordoVisivel(false)
    router.back()
  }

  const handlePedirReboque = () => {
    setModalNaoConcordoVisivel(false)
    router.push({
      pathname: '/pedido/novo',
      params: { categoriaId: '6', categoriaNome: 'Reboque e Socorro' }
    })
  }

  const tempoTurno = segundosTurno != null
    ? `${Math.floor(segundosTurno / 60)}:${String(segundosTurno % 60).padStart(2, '0')}`
    : null

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1A1A2E" />
      </View>
    )
  }

  if (pagamentoFeito) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>🔒</Text>
        <Text style={styles.successTitle}>{mensagemSucesso}</Text>
        <Text style={styles.successDesc}>{subSucesso}</Text>
        <View style={styles.successCard}>
          <Text style={styles.successCardLabel}>✓ Mestre Notificado em Tempo Real</Text>
          <Text style={styles.successCardSub}>O valor acordado foi processado na plataforma sem contacto telefónico.</Text>
        </View>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => {
            if (mensagemSucesso.includes('Diagnóstico')) {
              router.push({ pathname: '/pedido/confirmar', params: { jobId: params.jobId } })
            } else {
              router.push({ pathname: '/pedido/mestre-a-caminho', params: { jobId: params.jobId } })
            }
          }}
        >
          <Text style={styles.btnText}>
            {mensagemSucesso.includes('Diagnóstico') ? 'Concluir Pedido →' : 'Acompanhar Mestre no Mapa →'}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.push('/')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orçamento do Mestre</Text>
        <Text style={styles.headerSub}>
          {params.categoriaEmoji ?? '🔧'} {params.mestreNome ?? 'Mestre Pro'} · Negociação no Sistema
        </Text>
        <TouchableOpacity
          style={styles.headerChatBtn}
          onPress={() => router.push({ pathname: '/chat', params: { jobId: params.jobId } })}
          activeOpacity={0.8}
        >
          <Text style={styles.headerChatBtnText}>💬 Mensagens</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Tabela do Orçamento Detalhado */}
        <View style={styles.tabela}>
          <Text style={styles.tabelaLabel}>DETALHE DO ORÇAMENTO APRESENTADO</Text>
          {lines.map((l, i) => (
            <View key={i} style={styles.tabelaLinha}>
              <Text style={styles.tabelaDescricao}>{l.descricao}</Text>
              <Text style={styles.tabelaValor}>MT {l.valor.toLocaleString('pt-MZ')}</Text>
            </View>
          ))}
          <View style={styles.tabelaTotal}>
            <Text style={styles.tabelaTotalLabel}>TOTAL A PAGAR</Text>
            <Text style={styles.tabelaTotalValor}>MT {total.toLocaleString('pt-MZ')}</Text>
          </View>
        </View>

        <View style={styles.escrowInfo}>
          <Text style={styles.escrowIcon}>🔒</Text>
          <Text style={styles.escrowText}>
            Sem dinheiro em mão antecipado. Ao concordar, o valor fica retido na plataforma e só é pago ao mestre no fim.
          </Text>
        </View>

        {sandbox.active && (
          <View style={styles.sandboxBanner}>
            <Text style={styles.sandboxBannerText}>
              🧪 MODO SANDBOX ATIVO — os serviços custam entre MT {sandbox.min} e MT {sandbox.max}.
            </Text>
          </View>
        )}

        {mensagemMestre && (
          <View style={styles.mensagemMestreBox}>
            <Text style={styles.mensagemMestreLabel}>💬 MENSAGEM DO MESTRE</Text>
            <Text style={styles.mensagemMestreTexto}>"{mensagemMestre}"</Text>
          </View>
        )}

        {negociacaoExpirada ? (
          /* A janela de negociação fechou sem acordo */
          <View style={[styles.negociacaoCard, styles.negociacaoCardExpirada]}>
            <Text style={styles.negociacaoTitle}>⌛ NEGOCIAÇÃO EXPIRADA</Text>
            <Text style={styles.negociacaoDesc}>
              A janela de negociação fechou sem acordo. O pedido foi reaberto para outros mestres.
            </Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace('/')}>
              <Text style={styles.btnText}>Voltar ao Início</Text>
            </TouchableOpacity>
          </View>
        ) : aguardandoMestre ? (
          /* O cliente enviou uma contra-proposta: só o mestre pode aceitar/recusar */
          <View style={styles.negociacaoCard}>
            <Text style={styles.negociacaoTitle}>⏳ CONTRA-PROPOSTA ENVIADA AO MESTRE</Text>
            <Text style={styles.negociacaoDesc}>
              Propuseste MT {contraDeCliente.toLocaleString('pt-MZ')}. Aguarda a resposta do mestre no sistema — só ele pode aceitar ou recusar a tua contra-proposta.
            </Text>
            {tempoTurno && <Text style={styles.turnoTempo}>⏱ Resposta do mestre: {tempoTurno}</Text>}
          </View>
        ) : semOrcamentoMestre ? (
          /* O mestre aceitou o pedido mas ainda não enviou o orçamento */
          <View style={styles.negociacaoCard}>
            <Text style={styles.negociacaoTitle}>⏳ À ESPERA DO ORÇAMENTO DO MESTRE</Text>
            <Text style={styles.negociacaoDesc}>
              O mestre aceitou o teu pedido e está a preparar o orçamento. Vais poder concordar ou negociar assim que ele enviar o valor.
            </Text>
            {tempoTurno && <Text style={styles.turnoTempo}>⏱ Orçamento do mestre: {tempoTurno}</Text>}
          </View>
        ) : pagamentoPendente ? (
          /* Pagamento em processamento na PaySuite */
          <View style={styles.negociacaoCard}>
            <Text style={styles.negociacaoTitle}>⏳ PAGAMENTO EM PROCESSAMENTO</Text>
            <Text style={styles.negociacaoDesc}>
              Conclui o pagamento de MT {total.toLocaleString('pt-MZ')} na janela da PaySuite (e-Mola / M-Pesa / Cartão). Assim que for confirmado, o valor fica retido e o mestre é notificado.
            </Text>
            {pagamentoPendente.url && (
              <TouchableOpacity
                style={[styles.btnPrimary, { marginTop: 12 }]}
                onPress={() => Linking.openURL(pagamentoPendente.url as string)}
              >
                <Text style={styles.btnText}>Abrir Pagamento PaySuite</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 12, backgroundColor: '#166534' }]}
              onPress={() => verificarPagamento(actualJobId || params.jobId)}
              disabled={verificandoPagamento}
            >
              <Text style={styles.btnText}>
                {verificandoPagamento ? 'A verificar pagamento...' : 'Já paguei — Verificar agora'}
              </Text>
            </TouchableOpacity>
            <Text style={{ color: '#78350F', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
              Se já pagaste e a confirmação não apareceu, toca em verificar. A confirmação chega automaticamente assim que a PaySuite responder.
            </Text>
            <TouchableOpacity
              style={{ marginTop: 12, alignItems: 'center' }}
              onPress={handleCancelarPagamentoPendente}
            >
              <Text style={{ color: '#B45309', fontWeight: '800' }}>Cancelar / Escolher outro método</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* AS 3 OPÇÕES EXIGIDAS NO SISTEMA (só quando o mestre já propôs um valor) */
          <View style={styles.botoesContainer}>
            {tempoTurno && (
              <Text style={[styles.turnoTempo, { textAlign: 'center', color: '#78350F' }]}>
                ⏱ Tens {tempoTurno} para responder
              </Text>
            )}
            {/* 1. CONCORDO */}
            <TouchableOpacity 
              style={styles.btnConcordo} 
              onPress={() => setModalPagamentoVisivel(true)}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={styles.btnConcordoText}>✓ Concordo (MT {total.toLocaleString('pt-MZ')})</Text>
            </TouchableOpacity>

            {/* 2. ESTÁ PUXADO (Negociar / Pedir Desconto) */}
            <TouchableOpacity 
              style={styles.btnPuxado} 
              onPress={() => {
                setContraValor(Math.round(total * 0.85).toString())
                setModalPuxadoVisivel(true)
              }}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={styles.btnPuxadoText}>💬 Está Puxado (Pedir Desconto / Contra-oferta)</Text>
            </TouchableOpacity>

            {/* 3. NÃO CONCORDO */}
            <TouchableOpacity 
              style={styles.btnNaoConcordo} 
              onPress={() => setModalNaoConcordoVisivel(true)}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={styles.btnNaoConcordoText}>✕ Não Concordo (Problema Diferente / Recusar)</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* MODAL "ESTÁ PUXADO" PARA CONTRA-PROPOSTA NO SISTEMA */}
      <Modal visible={modalPuxadoVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💬 "Está Puxado!"</Text>
            <Text style={styles.modalSub}>
              O valor actual é MT {total.toLocaleString('pt-MZ')}. Quanto pretendes propor ao mestre?
            </Text>

            <View style={styles.inputRow}>
              <Text style={styles.mtPrefix}>MT</Text>
              <TextInput
                style={styles.inputContra}
                placeholder="Ex: 750"
                keyboardType="numeric"
                value={contraValor}
                onChangeText={setContraValor}
              />
            </View>

            <View style={styles.quickButtons}>
              <TouchableOpacity 
                style={styles.quickBtn}
                onPress={() => setContraValor(Math.round(total * 0.85).toString())}
              >
                <Text style={styles.quickBtnText}>-15% ({Math.round(total * 0.85)} MT)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickBtn}
                onPress={() => setContraValor(Math.round(total * 0.80).toString())}
              >
                <Text style={styles.quickBtnText}>-20% ({Math.round(total * 0.80)} MT)</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.inputNota}
              placeholder="Mensagem opcional para o mestre (ex: é o que tenho)"
              placeholderTextColor="#9CA3AF"
              value={contraNota}
              onChangeText={setContraNota}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalBtnCancel} 
                onPress={() => setModalPuxadoVisivel(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalBtnConfirm} 
                onPress={handleEnviarPuxado}
                disabled={isSubmitting}
              >
                <Text style={styles.modalBtnConfirmText}>
                  {isSubmitting ? 'A Enviar...' : 'Enviar Contra-Proposta'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL "NÃO CONCORDO / PROBLEMA DIFERENTE NO TERRENO" */}
      <Modal visible={modalNaoConcordoVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Não Concorda com o Orçamento?</Text>
            <Text style={styles.modalSub}>
              Se o problema no terreno for diferente do que descreveu ou se não pretende avançar com a reparação completa, escolha como deseja proceder:
            </Text>

            <TouchableOpacity 
              style={styles.opcaoResolucaoCard}
              onPress={handlePagarApenasDeslocacao}
              activeOpacity={0.8}
            >
              <Text style={styles.opcaoResolucaoTitulo}>⚡ 1. Pagar Apenas Deslocação & Diagnóstico (MT 250)</Text>
              <Text style={styles.opcaoResolucaoTexto}>
                Compensa o mestre pelo tempo e combustível gastos até ao local. O serviço é encerrado sem dívidas.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.opcaoResolucaoCard, { borderColor: '#38BDF8', backgroundColor: '#F0F9FF' }]}
              onPress={handlePedirReboque}
              activeOpacity={0.8}
            >
              <Text style={[styles.opcaoResolucaoTitulo, { color: '#0369A1' }]}>🚜 2. O Carro Precisa de Oficina (Pedir Reboque)</Text>
              <Text style={[styles.opcaoResolucaoTexto, { color: '#0C4A6E' }]}>
                Chama um reboque para levar o veículo para a sua oficina de confiança.
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalBtnCancel} 
                onPress={() => setModalNaoConcordoVisivel(false)}
              >
                <Text style={styles.modalBtnCancelText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtnCancel, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]} 
                onPress={handleCancelarSemCustos}
              >
                <Text style={{ color: '#B91C1C', fontWeight: 'bold' }}>Rejeitar e Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE PAGAMENTO (PaySuite) */}
      <Modal visible={modalPagamentoVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💳 Pagamento Seguro</Text>
            <Text style={styles.modalSub}>
              Escolhe como queres pagar os MT {total.toLocaleString('pt-MZ')}. O valor fica retido (Escrow) e só é pago ao mestre no fim.
            </Text>

            <TouchableOpacity style={styles.metodoBtn} onPress={() => handleConcordo('mpesa')} disabled={isSubmitting} activeOpacity={0.85}>
              <Text style={styles.metodoBtnText}>📱 M-Pesa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.metodoBtn} onPress={() => handleConcordo('emola')} disabled={isSubmitting} activeOpacity={0.85}>
              <Text style={styles.metodoBtnText}>📲 e-Mola</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.metodoBtn} onPress={() => handleConcordo('card')} disabled={isSubmitting} activeOpacity={0.85}>
              <Text style={styles.metodoBtnText}>💳 Cartão</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setModalPagamentoVisivel(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalBtnCancelText}>{isSubmitting ? 'A preparar...' : 'Cancelar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const TINTA = '#1A1A2E'
const PAPEL = '#F5F0E8'
const AMARELO = '#F2C94C'
const ZINCO = '#6B7280'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPEL },
  scroll: { flex: 1 },
  header: { backgroundColor: TINTA, paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20, marginBottom: 16 },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: AMARELO, fontWeight: '800', fontSize: 13 },
  headerTitle: { color: PAPEL, fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  headerSub: { color: AMARELO, fontSize: 13, fontWeight: '700' },
  headerChatBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: AMARELO, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  headerChatBtnText: { color: AMARELO, fontSize: 12, fontWeight: '900' },
  negociacaoCard: { marginHorizontal: 20, backgroundColor: '#FEF3C7', padding: 14, borderRadius: 8, borderWidth: 1.5, borderColor: '#F59E0B', marginBottom: 16 },
  negociacaoCardExpirada: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  negociacaoTitle: { color: '#B45309', fontWeight: '900', fontSize: 12, marginBottom: 4 },
  negociacaoDesc: { color: '#78350F', fontSize: 13, lineHeight: 18 },
  turnoTempo: { color: '#B45309', fontWeight: '900', fontSize: 13, marginTop: 8 },
  tabela: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 8, padding: 18, borderWidth: 2, borderColor: '#E5E7EB', marginBottom: 14 },
  tabelaLabel: { fontSize: 10, fontWeight: '800', color: ZINCO, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  tabelaLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  tabelaDescricao: { flex: 1, fontSize: 14, color: TINTA, paddingRight: 12 },
  tabelaValor: { fontSize: 14, fontWeight: '800', color: TINTA },
  tabelaTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, marginTop: 4 },
  tabelaTotalLabel: { fontSize: 13, fontWeight: '900', color: TINTA, textTransform: 'uppercase', letterSpacing: 1 },
  tabelaTotalValor: { fontSize: 22, fontWeight: '900', color: '#166534' },
  escrowInfo: { flexDirection: 'row', gap: 10, marginHorizontal: 20, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 20, alignItems: 'center' },
  escrowIcon: { fontSize: 20 },
  escrowText: { flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 17 },
  mensagemMestreBox: { marginHorizontal: 20, marginBottom: 20, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#FCD34D' },
  mensagemMestreLabel: { fontSize: 10, fontWeight: '900', color: '#92400E', letterSpacing: 1, marginBottom: 4 },
  mensagemMestreTexto: { fontSize: 13, color: '#78350F', lineHeight: 19, fontStyle: 'italic' },
  sandboxBanner: { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FEF9C3', borderRadius: 8, padding: 12, borderWidth: 1.5, borderColor: '#CA8A04' },
  sandboxBannerText: { color: '#854D0E', fontSize: 12, fontWeight: '900', textAlign: 'center', lineHeight: 17 },
  botoesContainer: { marginHorizontal: 20, gap: 10, paddingBottom: 30 },
  btnConcordo: { backgroundColor: '#166534', borderRadius: 8, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: '#4ADE80' },
  btnConcordoText: { color: '#fff', fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnPuxado: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: '#F59E0B' },
  btnPuxadoText: { color: '#B45309', fontWeight: '900', fontSize: 14 },
  btnNaoConcordo: { backgroundColor: '#fff', borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#EF4444' },
  btnNaoConcordoText: { color: '#EF4444', fontWeight: '800', fontSize: 14 },
  // Sucesso
  successContainer: { flex: 1, backgroundColor: '#0F2D1A', alignItems: 'center', justifyContent: 'center', padding: 28 },
  successIcon: { fontSize: 60, marginBottom: 16 },
  successTitle: { fontSize: 26, fontWeight: '900', color: PAPEL, textAlign: 'center', marginBottom: 10 },
  successDesc: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 16, width: '100%', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  successCardLabel: { color: '#4ADE80', fontWeight: '900', fontSize: 14, marginBottom: 4 },
  successCardSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  btnPrimary: { backgroundColor: AMARELO, borderRadius: 6, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', width: '100%' },
  btnText: { color: TINTA, fontWeight: '900', fontSize: 14, textTransform: 'uppercase' },
  // Modal Puxado
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: TINTA, marginBottom: 6 },
  modalSub: { fontSize: 13, color: ZINCO, lineHeight: 19, marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12, backgroundColor: '#FFFBEB' },
  mtPrefix: { fontSize: 18, fontWeight: '900', color: '#B45309', marginRight: 8 },
  inputContra: { flex: 1, fontSize: 20, fontWeight: '900', color: TINTA, paddingVertical: 12 },
  quickButtons: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  quickBtn: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  quickBtnText: { fontSize: 12, fontWeight: '700', color: TINTA },
  inputNota: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 13, color: TINTA, marginBottom: 20, backgroundColor: '#FAFAFA' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' },
  modalBtnCancelText: { color: ZINCO, fontWeight: '700', fontSize: 14 },
  modalBtnConfirm: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: 6, backgroundColor: '#F59E0B' },
  modalBtnConfirmText: { color: '#1A1A2E', fontWeight: '900', fontSize: 14 },
  metodoBtn: { backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  metodoBtnText: { color: TINTA, fontWeight: '900', fontSize: 15 },
  // Resolução Discrepância Card
  opcaoResolucaoCard: { backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#F59E0B', borderRadius: 8, padding: 14, marginBottom: 12 },
  opcaoResolucaoTitulo: { fontSize: 14, fontWeight: '900', color: '#B45309', marginBottom: 4 },
  opcaoResolucaoTexto: { fontSize: 12, color: '#78350F', lineHeight: 17 },
})
