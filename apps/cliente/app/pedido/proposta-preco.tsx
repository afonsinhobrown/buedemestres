import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function PropostaPrecoScreen() {
  const params = useLocalSearchParams<{
    jobId: string
    mestreNome?: string
    categoriaEmoji?: string
  }>()

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
  const [puxadoEnviado, setPuxadoEnviado] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function carregarPropostaReal() {
      if (!params.jobId) {
        setLoading(false)
        return
      }

      try {
        const { data: prop } = await supabase
          .from('job_price_proposals')
          .select('*')
          .or(`job_id.eq.${params.jobId}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (prop) {
          setProposalData(prop)
          setTotal(prop.amount)
          setActualJobId(prop.job_id)
          try {
            const parsedLines = JSON.parse(prop.description)
            if (Array.isArray(parsedLines) && parsedLines.length > 0) {
              setLines(parsedLines.map((l: any) => ({
                descricao: l.description || 'Serviço',
                valor: parseFloat(l.price) || 0
              })))
            }
          } catch {
            setLines([{ descricao: prop.description || 'Orçamento do Mestre', valor: prop.amount }])
          }
        } else {
          const { data: req } = await supabase
            .from('service_requests')
            .select('budget_max, title')
            .eq('id', params.jobId)
            .maybeSingle()

          if (req?.budget_max) {
            setTotal(req.budget_max)
            setLines([{ descricao: req.title || 'Serviço solicitado', valor: req.budget_max }])
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar proposta:', err)
      } finally {
        setLoading(false)
      }
    }

    carregarPropostaReal()
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

  // 1. OPÇÃO: "CONCORDO" (Aceita proposta completa e retém valor)
  const handleConcordo = async () => {
    try {
      setIsSubmitting(true)
      const target = actualJobId || params.jobId

      if (proposalData?.id) {
        await supabase
          .from('job_price_proposals')
          .update({ status: 'accepted' })
          .eq('id', proposalData.id)
      }

      await supabase
        .from('jobs')
        .update({
          status: 'price_agreed',
          agreed_amount: total
        })
        .or(`id.eq.${target},request_id.eq.${target}`)

      await supabase
        .from('service_requests')
        .update({
          status: 'accepted',
          budget_max: total
        })
        .or(`id.eq.${target}`)

      try {
        await supabase.from('job_payments').upsert({
          job_id: target,
          client_id: '11111111-1111-1111-1111-111111111111',
          provider_id: '22222222-2222-2222-2222-222222222222',
          amount: total,
          commission_rate: 0.12,
          commission_amount: total * 0.12,
          provider_payout: total * 0.88,
          method: 'mpesa',
          status: 'held',
          held_at: new Date().toISOString()
        }, { onConflict: 'job_id' })
      } catch (e) {
        console.warn('Job payments upsert:', e)
      }

      setMensagemSucesso('Acordo Fechado no Sistema!')
      setSubSucesso(`MT ${total.toLocaleString('pt-MZ')} retido em segurança (Escrow). O mestre já foi notificado e pode iniciar o trabalho.`)
      setPagamentoFeito(true)
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível confirmar o acordo.')
    } finally {
      setIsSubmitting(false)
    }
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

      // 1. Obter o job real para mapear ambos os IDs
      const { data: job } = await supabase
        .from('jobs')
        .select('id, request_id, provider_id')
        .or(`id.eq.${target},request_id.eq.${target}`)
        .maybeSingle()

      const jId = job?.id || target
      const rId = job?.request_id || target

      // 2. Registar em job_price_proposals com amount da contra-proposta
      await supabase.from('job_price_proposals').insert({
        job_id: jId,
        proposed_by: '11111111-1111-1111-1111-111111111111',
        amount: counterMt,
        description: notaFinal,
        status: 'pending'
      })

      // Se houver proposta anterior, também actualizar
      if (proposalData?.id) {
        await supabase
          .from('job_price_proposals')
          .update({
            amount: counterMt,
            description: notaFinal,
            status: 'pending'
          })
          .eq('id', proposalData.id)
      }

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
      const proId = job?.provider_id || '22222222-2222-2222-2222-222222222222'
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

      setModalPuxadoVisivel(false)
      setPuxadoEnviado(true)
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
      </View>

      <ScrollView style={styles.scroll}>
        {/* Banner se já enviou contra-proposta "Está puxado" */}
        {puxadoEnviado && (
          <View style={styles.negociacaoCard}>
            <Text style={styles.negociacaoTitle}>⏳ NEGOCIAÇÃO ENVIADA ("ESTÁ PUXADO")</Text>
            <Text style={styles.negociacaoDesc}>
              Propuseste MT {parseFloat(contraValor || '0').toLocaleString('pt-MZ')}. O mestre recebeu o teu pedido e está a rever o valor no aplicativo.
            </Text>
          </View>
        )}

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

        {/* AS 3 OPÇÕES EXIGIDAS NO SISTEMA */}
        <View style={styles.botoesContainer}>
          {/* 1. CONCORDO */}
          <TouchableOpacity 
            style={styles.btnConcordo} 
            onPress={handleConcordo}
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
  negociacaoCard: { marginHorizontal: 20, backgroundColor: '#FEF3C7', padding: 14, borderRadius: 8, borderWidth: 1.5, borderColor: '#F59E0B', marginBottom: 16 },
  negociacaoTitle: { color: '#B45309', fontWeight: '900', fontSize: 12, marginBottom: 4 },
  negociacaoDesc: { color: '#78350F', fontSize: 13, lineHeight: 18 },
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
  // Resolução Discrepância Card
  opcaoResolucaoCard: { backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#F59E0B', borderRadius: 8, padding: 14, marginBottom: 12 },
  opcaoResolucaoTitulo: { fontSize: 14, fontWeight: '900', color: '#B45309', marginBottom: 4 },
  opcaoResolucaoTexto: { fontSize: 12, color: '#78350F', lineHeight: 17 },
})
