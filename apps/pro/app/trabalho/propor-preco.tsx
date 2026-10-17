import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { validateAntiPhoneBypass } from '../../lib/antiPhoneBypass';
import { useAuthStore } from '../../lib/useAuthStore';
import { loadSandboxSettings } from '../../lib/sandbox';
import { mostrarAlerta } from '../../lib/alerts';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

interface ServiceLine {
  id: string;
  description: string;
  price: string;
}

export default function ProporPrecoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; offerId?: string; transporte?: string }>();
  const targetId = params.jobId || params.offerId || '';
  const user = useAuthStore((s) => s.user);

  // Modo: 'simples' (apenas campo de valor único) ou 'detalhado' (criar orçamento discriminado)
  const [modoPreco, setModoPreco] = useState<'simples' | 'detalhado'>('simples');
  const [valorSimples, setValorSimples] = useState('800');

  // Orçamento discriminado assistido pelo sistema
  const [lines, setLines] = useState<ServiceLine[]>([
    { id: '1', description: 'Diagnóstico e Deslocação', price: '250' },
    { id: '2', description: 'Mão de obra da reparação', price: '550' }
  ]);

  // Campo para pedir mais detalhes / mensagem ao cliente (com anti-bypass)
  const [mensagemDetalhes, setMensagemDetalhes] = useState('');
  const [msgBypassError, setMsgBypassError] = useState<string | null>(null);

  const [jobData, setJobData] = useState<any>(null);
  const [actualJobId, setActualJobId] = useState<string>('');
  const [actualRequestId, setActualRequestId] = useState<string>(targetId);
  const [clientFeedback, setClientFeedback] = useState<string | null>(null);
  const [contraValorCliente, setContraValorCliente] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sandbox, setSandbox] = useState<{ active: boolean; min: number; max: number }>({
    active: true,
    min: 1,
    max: 10,
  });

  useEffect(() => {
    let mounted = true
    const carregarSandbox = async () => {
      try {
        const settings = await loadSandboxSettings()
        if (mounted) {
          setSandbox(settings)
          if (settings.active) {
            setValorSimples(String(settings.max))
            setLines([{ id: '1', description: 'Taxa dentro do limite sandbox', price: String(settings.max) }])
          }
        }
      } catch {
        // mantém o default
      }
    }
    carregarSandbox()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    async function loadCurrentJob() {
      if (!targetId) {
        setLoading(false);
        return;
      }
      try {
        // Carregar pedido e cliente
        let { data: req } = await supabase
          .from('service_requests')
          .select('*, profiles:client_id(full_name, avatar_url)')
          .eq('id', targetId)
          .maybeSingle();

        if (req) {
          setActualRequestId(req.id);
          setJobData(req);
        }

        // Carregar job se existir (pode ser criado pelo cliente após o "Está puxado")
        const { data: job } = await supabase
          .from('jobs')
          .select('id, request_id, status, price_proposed, price_estimate_min, client_id, provider_id')
          .or(`id.eq.${targetId},request_id.eq.${targetId}`)
          .maybeSingle();

        if (job) {
          setActualJobId(job.id);
          // O parâmetro pode ser o id do job (ex.: vindo de "aguardar-pagamento").
          // Nesse caso o pedido tem de ser resolvido pelo job.request_id.
          if (job.request_id) {
            setActualRequestId(job.request_id);
            if (!req) {
              const { data: reqDoJob } = await supabase
                .from('service_requests')
                .select('*, profiles:client_id(full_name, avatar_url)')
                .eq('id', job.request_id)
                .maybeSingle();
              if (reqDoJob) {
                req = reqDoJob;
                setJobData(reqDoJob);
              }
            }
          }

          const { data: prop } = await supabase
            .from('job_price_proposals')
            .select('*')
            .eq('job_id', job.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const propEhDoCliente = !!prop && (
            prop.proposed_by === job.client_id ||
            (prop.description && prop.description.includes('[ESTÁ PUXADO'))
          );

          if (propEhDoCliente) {
            setClientFeedback(prop!.description);
            setContraValorCliente(Number(prop!.amount));
          } else if (job.status !== 'puxado') {
            setClientFeedback(null);
            setContraValorCliente(null);
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar detalhes do trabalho:', e);
      } finally {
        setLoading(false);
      }
    }

    loadCurrentJob();

    // O cliente pode enviar a contra-proposta enquanto o mestre está neste ecrã.
    const pollTimer = setInterval(loadCurrentJob, 3000);
    const channel = supabase
      .channel(`pro_prop_${targetId}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_price_proposals' }, () => loadCurrentJob())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => loadCurrentJob())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => loadCurrentJob())
      .subscribe();

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [targetId]);

  const handleMensagemChange = (text: string) => {
    setMensagemDetalhes(text);
    const validation = validateAntiPhoneBypass(text);
    if (!validation.isValid) {
      setMsgBypassError(validation.errorMessage || 'Não é permitido partilhar contactos.');
    } else {
      setMsgBypassError(null);
    }
  };

  const addLine = () => {
    setLines([...lines, { id: Math.random().toString(), description: '', price: '' }]);
  };

  const updateLine = (id: string, field: 'description' | 'price', value: string) => {
    setLines(lines.map(line => line.id === id ? { ...line, [field]: value } : line));
  };

  const removeLine = (id: string) => {
    setLines(lines.filter(line => line.id !== id));
  };

  // Atalho rápido: Problema diferente no terreno -> cobra apenas taxa de deslocação e diagnóstico
  const handleApenasDeslocacao = () => {
    setModoPreco('simples');
    setValorSimples('250');
    setLines([
      { id: 'deslocacao_diag', description: 'Taxa de Deslocação e Diagnóstico Presencial', price: '250' }
    ]);
  };

  const totalCalculado = modoPreco === 'simples'
    ? (parseFloat(valorSimples) || 0)
    : lines.reduce((acc, line) => acc + (parseFloat(line.price) || 0), 0);

  const totalProposta = totalCalculado;

  const sandboxError = sandbox.active && (totalProposta < sandbox.min || totalProposta > sandbox.max)
    ? `No modo sandbox o valor tem de estar entre MT ${sandbox.min} e MT ${sandbox.max}.`
    : null;

  const submitProposal = async () => {
    if (msgBypassError) {
      mostrarAlerta('Aviso de Segurança', msgBypassError);
      return;
    }

    if (sandbox.active && (totalProposta < sandbox.min || totalProposta > sandbox.max)) {
      mostrarAlerta(
        'Modo sandbox',
        `O valor do serviço tem de estar entre ${sandbox.min} e ${sandbox.max} MT. Valores acima de ${sandbox.max} MT são rejeitados.`
      );
      return;
    }

    if (totalProposta <= 0) {
      mostrarAlerta('Preço Inválido', 'Indica um valor válido para o serviço.');
      return;
    }

    try {
      setIsSubmitting(true);

      const fator = totalCalculado > 0 ? totalProposta / totalCalculado : 1;
      const validLines = modoPreco === 'simples'
        ? [{ id: '1', description: jobData?.title || 'Serviço Profissional', price: String(totalProposta) }]
        : lines
            .filter(l => l.description.trim() !== '' && parseFloat(l.price) > 0)
            .map(l => ({ ...l, price: (parseFloat(l.price) * fator).toFixed(2) }));

      let jId = actualJobId;
      let requestId = actualRequestId || targetId;

      // O ecrã pode ser aberto com o id do job (ex.: a partir de
      // "aguardar-pagamento"). Nesse caso temos de resolver o pedido real
      // através de jobs.request_id, senão o cliente não é encontrado.
      const { data: job } = await supabase
        .from('jobs')
        .select('id, request_id, client_id, provider_id, status')
        .or(`id.eq.${targetId},request_id.eq.${targetId}`)
        .maybeSingle();

      if (job) {
        jId = job.id;
        if (job.request_id) requestId = job.request_id;
      }

      const providerId = job?.provider_id || jobData?.target_provider_id || user?.id;
      if (!providerId) {
        mostrarAlerta('Sessão', 'Precisas de entrar na tua conta de mestre.');
        return;
      }

      // 1. Obter dados do pedido e cliente
      const { data: req } = await supabase
        .from('service_requests')
        .select('id, client_id, title')
        .eq('id', requestId)
        .maybeSingle();

      const clientUserId = req?.client_id || job?.client_id;
      if (!clientUserId) {
        mostrarAlerta('Erro', 'Cliente não encontrado para este pedido.');
        return;
      }

      if (!jId) {
        const { data: createdJob, error: createdJobError } = await supabase
          .from('jobs')
          .upsert({
            request_id: requestId,
            client_id: clientUserId,
            provider_id: providerId,
            status: 'price_proposed',
            price_proposed: totalProposta
          }, { onConflict: 'request_id' })
          .select()
          .single();

        if (createdJobError || !createdJob) {
          throw new Error(createdJobError?.message || 'Não foi possível criar o trabalho.')
        }

        jId = createdJob.id;
      }

      const mensagem = mensagemDetalhes.trim();
      const payloadDesc = JSON.stringify({ lines: validLines, message: mensagem || null });

      // 2. Registar a proposta de orçamento em job_price_proposals
      const { error: proposalError } = await supabase.from('job_price_proposals').insert({
        job_id: jId || requestId,
        proposed_by: providerId,
        amount: totalProposta,
        description: payloadDesc,
        status: 'pending'
      });

      if (proposalError) {
        throw new Error(
          String(proposalError.message).includes('sandbox')
            ? `No modo sandbox o valor tem de estar entre MT ${sandbox.min} e MT ${sandbox.max}.`
            : proposalError.message || 'Não foi possível registar a proposta.'
        )
      }

      // 3. Actualizar jobs com status price_proposed
      const { error: jobUpdateError } = await supabase
        .from('jobs')
        .upsert({
          id: jId || undefined,
          request_id: requestId,
          client_id: clientUserId,
          provider_id: providerId,
          status: 'price_proposed',
          price_proposed: totalProposta,
          price_estimate_min: null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'request_id' });

      if (jobUpdateError) {
        throw new Error(jobUpdateError.message || 'Não foi possível atualizar o trabalho.')
      }

      // 4. Actualizar service_requests com status price_proposed e budget_max
      const { error: requestUpdateError } = await supabase
        .from('service_requests')
        .update({
          status: 'price_proposed',
          budget_max: totalProposta,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (requestUpdateError) {
        throw new Error(requestUpdateError.message || 'Não foi possível atualizar o pedido.')
      }

      // 5. Inserir notificação directa para o cliente na tabela notifications
      try {
        await supabase.from('notifications').insert({
          profile_id: clientUserId,
          type: 'price_proposed',
          title: 'Orçamento Recebido!',
          body: mensagem
            ? `O mestre propôs MT ${totalProposta} e pediu mais detalhes: "${mensagem}"`
            : `O mestre propôs o valor de MT ${totalProposta} para o seu pedido.`,
          data: {
            jobId: jId || requestId,
            requestId: requestId,
            amount: totalProposta,
            message: mensagem || null,
            title: req?.title || 'Serviço'
          }
        });
      } catch (notifErr) {
        console.warn('Erro ao inserir notificação na base de dados:', notifErr);
      }

      // O mestre aguarda a aprovação e pagamento do cliente antes de sair!
      // Passa o turno ao cliente com prazo (reinicia o relógio da negociação).
      await supabase.rpc('set_negotiation_turn', {
        p_job: jId || requestId,
        p_owner: 'client',
        p_is_counter: false
      })

      router.push(`/trabalho/aguardar-pagamento?jobId=${jId || requestId}&valor=${totalProposta}`);
    } catch (error: any) {
      console.error('Erro ao enviar proposta:', error);
      mostrarAlerta('Erro', error.message || 'Ocorreu um erro ao propor o preço.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#F2C94C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proposta de Orçamento</Text>
        <Text style={styles.headerSub}>
          Defina o valor no sistema. O mestre só parte após o cliente concordar e pagar.
        </Text>
        <TouchableOpacity
          style={styles.headerChatBtn}
          onPress={() => router.push({ pathname: '/chat', params: { jobId: targetId } })}
          activeOpacity={0.8}
        >
          <Text style={styles.headerChatBtnText}>💬 Mensagens / Pedir detalhes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {sandbox.active && (
          <View style={styles.sandboxBanner}>
            <Text style={styles.sandboxBannerText}>
              MODO SANDBOX ATIVO — os serviços custam entre MT {sandbox.min} e MT {sandbox.max}.
            </Text>
          </View>
        )}
        {/* Detalhes do Pedido do Cliente */}
        <View style={styles.problemaCard}>
          <Text style={styles.problemaCardLabel}>PROBLEMA RELATADO PELO CLIENTE:</Text>
          <Text style={styles.problemaCardTitulo}>{jobData?.title || 'Assistência Solicitada'}</Text>
          <Text style={styles.problemaCardDesc}>
            "{jobData?.description || 'Sem descrição adicional'}"
          </Text>
          <Text style={styles.problemaCardRef}>
            📍 Local: {jobData?.location_note || 'Bairro Zimpeto, Maputo'}
          </Text>
        </View>

        {/* Alerta de negociação se o cliente tiver achado puxado */}
        {clientFeedback && (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackTitle}>⚠️ NEGOCIAÇÃO EM CURSO COM CLIENTE</Text>
            <Text style={styles.feedbackText}>{clientFeedback}</Text>
            {contraValorCliente ? (
              <Text style={styles.feedbackValor}>
                O cliente propôs: MT {contraValorCliente.toLocaleString('pt-MZ')}
              </Text>
            ) : null}
            <Text style={styles.feedbackHint}>Aceita a contra-proposta ou ajusta o valor abaixo para fechar o acordo no sistema.</Text>
            <TouchableOpacity
              style={styles.btnResponder}
              onPress={() => router.push(`/trabalho/aguardar-pagamento?jobId=${actualJobId || targetId}&valor=${contraValorCliente ?? ''}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnResponderText}>Rever e Responder à Contra-Proposta →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Escolha do Modo de Orçamento: Simples ou Detalhado */}
        <Text style={styles.sectionLabel}>COMO QUER APRESENTAR O PREÇO?</Text>
        <View style={styles.modoSelector}>
          <TouchableOpacity 
            style={[styles.modoBtn, modoPreco === 'simples' && styles.modoBtnAtivo]}
            onPress={() => setModoPreco('simples')}
          >
            <Text style={[styles.modoBtnText, modoPreco === 'simples' && styles.modoBtnTextAtivo]}>
              ⚡ Preço Único (Direto)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.modoBtn, modoPreco === 'detalhado' && styles.modoBtnAtivo]}
            onPress={() => setModoPreco('detalhado')}
          >
            <Text style={[styles.modoBtnText, modoPreco === 'detalhado' && styles.modoBtnTextAtivo]}>
              📋 Criar Orçamento Detalhado
            </Text>
          </TouchableOpacity>
        </View>

        {/* MODO 1: Preço Único no Campo */}
        {modoPreco === 'simples' && (
          <View style={styles.simplesCard}>
            <Text style={styles.simplesLabel}>INTRODUZ O VALOR TOTAL DO SERVIÇO</Text>
            <View style={styles.simplesInputRow}>
              <Text style={styles.simplesPrefix}>MT</Text>
              <TextInput
                style={styles.simplesInput}
                placeholder="Ex: 800"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={valorSimples}
                onChangeText={setValorSimples}
              />
            </View>
            <Text style={styles.simplesHint}>
              Preço direto sem discriminação de partes de trabalho.
            </Text>
          </View>
        )}

        {/* MODO 2: Orçamento Detalhado por partes de trabalho */}
        {modoPreco === 'detalhado' && (
          <View>
            {lines.map((line, index) => (
              <View key={line.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemNum}>
                    {index === 0 ? 'ITEM 1: DIAGNÓSTICO & DESLOCAÇÃO (SUGESTÃO DO SISTEMA)' : `ITEM ${index + 1}`}
                  </Text>
                  {lines.length > 1 && (
                    <TouchableOpacity onPress={() => removeLine(line.id)}>
                      <Text style={styles.removerText}>Remover ✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput
                  style={styles.inputDesc}
                  placeholder="Descrição da parte de trabalho ou peça..."
                  placeholderTextColor="#94A3B8"
                  value={line.description}
                  onChangeText={(text) => updateLine(line.id, 'description', text)}
                />

                <View style={styles.priceRow}>
                  <Text style={styles.currencyPrefix}>MT</Text>
                  <TextInput
                    style={styles.inputPrice}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={line.price}
                    onChangeText={(text) => updateLine(line.id, 'price', text)}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity onPress={addLine} style={styles.btnAddLine} activeOpacity={0.8}>
              <Text style={styles.btnAddLineText}>+ Adicionar outro serviço / peça</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Atalho para Problema Diferente no Terreno */}
        <TouchableOpacity style={styles.btnDeslocacaoRapida} onPress={handleApenasDeslocacao} activeOpacity={0.8}>
          <Text style={styles.btnDeslocacaoRapidaText}>
            ⚡ Cobrar Apenas Deslocação & Diagnóstico (MT 250)
          </Text>
        </TouchableOpacity>

        {/* Campo de Pedir Mais Detalhes / Observação com Filtro Anti-Telefone */}
        <View style={styles.msgBox}>
          <Text style={styles.msgLabel}>PEDIR MAIS DETALHES OU NOTA AO CLIENTE (OPCIONAL):</Text>
          <TextInput
            style={[styles.msgInput, msgBypassError && styles.msgInputError]}
            placeholder="Ex: Preciso de saber se o motor faz barulho ao rodar a chave."
            placeholderTextColor="#94A3B8"
            value={mensagemDetalhes}
            onChangeText={handleMensagemChange}
            multiline
          />
          {msgBypassError && (
            <Text style={styles.msgErrorText}>⚠️ {msgBypassError}</Text>
          )}
        </View>

        {/* Card do Total */}
        <View style={styles.totalCard}>
          <View>
            <Text style={styles.totalLabel}>TOTAL A PROPOR</Text>
            <Text style={styles.totalNota}>O cliente paga e o valor fica retido (Escrow)</Text>
          </View>
          <Text style={styles.totalValor}>MT {totalProposta.toLocaleString('pt-MZ')}</Text>
        </View>

        {sandboxError && (
          <View style={styles.sandboxErrorBox}>
            <Text style={styles.sandboxErrorText}>⚠️ {sandboxError}</Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>🔒</Text>
          <Text style={styles.infoText}>
            O cliente recebe no telemóvel as opções: "Concordo", "Não concordo" ou "Está puxado". Apenas após o pagamento retido confirmas a tua partida no mapa.
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity 
        onPress={submitProposal}
        disabled={isSubmitting || !!msgBypassError || !!sandboxError}
        style={[styles.btnSubmit, (isSubmitting || !!msgBypassError || !!sandboxError) && { opacity: 0.6 }]}
        activeOpacity={0.8}
      >
        <Text style={styles.btnSubmitText}>
          {isSubmitting ? 'A Enviar...' : sandboxError ? 'Valor fora do limite sandbox' : `Enviar Proposta ao Cliente (MT ${totalProposta.toLocaleString('pt-MZ')}) →`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A', padding: 20, paddingTop: 48 },
  header: { marginBottom: 12 },
  backBtn: { marginBottom: 6 },
  backBtnText: { color: '#F2C94C', fontWeight: '800', fontSize: 13 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#F5F0E8', marginBottom: 2 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  headerChatBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(242,201,76,0.12)', borderWidth: 1, borderColor: '#F2C94C', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  headerChatBtnText: { color: '#F2C94C', fontSize: 11, fontWeight: '900' },
  scroll: { flex: 1 },
  sandboxBanner: { backgroundColor: 'rgba(242,201,76,0.18)', borderWidth: 1.5, borderColor: '#F2C94C', borderRadius: 8, padding: 10, marginBottom: 12 },
  sandboxBannerText: { color: '#F2C94C', fontWeight: '900', fontSize: 11, textAlign: 'center' },
  problemaCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  problemaCardLabel: { fontSize: 10, fontWeight: '800', color: '#F2C94C', letterSpacing: 1 },
  problemaCardTitulo: { fontSize: 16, fontWeight: '900', color: '#fff', marginTop: 2 },
  problemaCardDesc: { fontSize: 13, color: '#E2E8F0', fontStyle: 'italic', marginTop: 4 },
  problemaCardRef: { fontSize: 12, color: '#38BDF8', marginTop: 6, fontWeight: '600' },
  feedbackBanner: { backgroundColor: 'rgba(242, 201, 76, 0.15)', borderWidth: 1.5, borderColor: '#F2C94C', borderRadius: 8, padding: 12, marginBottom: 14 },
  feedbackTitle: { color: '#F2C94C', fontWeight: '900', fontSize: 11, letterSpacing: 0.5, marginBottom: 4 },
  feedbackText: { color: '#F5F0E8', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  feedbackHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  feedbackValor: { color: '#F2C94C', fontSize: 16, fontWeight: '900', marginVertical: 4 },
  btnResponder: { backgroundColor: '#F2C94C', borderRadius: 6, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  btnResponderText: { color: '#1A1A2E', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  modoSelector: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modoBtn: { flex: 1, paddingVertical: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  modoBtnAtivo: { backgroundColor: '#F2C94C', borderColor: '#F2C94C' },
  modoBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  modoBtnTextAtivo: { color: '#1A1A2E', fontWeight: '900' },
  simplesCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 14 },
  simplesLabel: { fontSize: 11, fontWeight: '800', color: '#F2C94C', marginBottom: 10 },
  simplesInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8, borderWidth: 1.5, borderColor: '#F2C94C', paddingHorizontal: 14 },
  simplesPrefix: { fontSize: 22, fontWeight: '900', color: '#F2C94C', marginRight: 10 },
  simplesInput: { flex: 1, fontSize: 24, fontWeight: '900', color: '#fff', paddingVertical: 12 },
  simplesHint: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 8 },
  itemCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemNum: { fontSize: 10, fontWeight: '800', color: '#F2C94C', textTransform: 'uppercase' },
  removerText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  inputDesc: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 10, color: '#fff', fontSize: 13, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  priceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10 },
  currencyPrefix: { color: '#F2C94C', fontWeight: '900', fontSize: 15, marginRight: 8 },
  inputPrice: { flex: 1, paddingVertical: 8, color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnAddLine: { paddingVertical: 10, alignItems: 'center', borderRadius: 6, borderWidth: 1.5, borderColor: '#38BDF8', borderStyle: 'dashed', backgroundColor: 'rgba(56, 189, 248, 0.08)', marginBottom: 12 },
  btnAddLineText: { color: '#38BDF8', fontWeight: '800', fontSize: 12 },
  btnDeslocacaoRapida: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: '#EF4444', borderRadius: 6, paddingVertical: 10, alignItems: 'center', marginBottom: 14 },
  btnDeslocacaoRapidaText: { color: '#FCA5A5', fontWeight: '800', fontSize: 12 },
  msgBox: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  msgLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 6 },
  msgInput: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 10, color: '#fff', fontSize: 13, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  msgInputError: { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  msgErrorText: { color: '#FCA5A5', fontSize: 11, fontWeight: 'bold', marginTop: 4 },
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#F2C94C', marginBottom: 14 },
  totalLabel: { fontSize: 11, fontWeight: '900', color: '#F2C94C', textTransform: 'uppercase', letterSpacing: 1 },
  totalNota: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  totalValor: { fontSize: 22, fontWeight: '900', color: '#F5F0E8' },
  sandboxErrorBox: { backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 8, padding: 10, marginBottom: 14 },
  sandboxErrorText: { color: '#FCA5A5', fontWeight: '900', fontSize: 12, textAlign: 'center' },
  infoBox: { flexDirection: 'row', gap: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 16 },
  infoIcon: { fontSize: 18 },
  infoText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 16 },
  btnSubmit: { backgroundColor: '#4ADE80', borderRadius: 8, paddingVertical: 16, alignItems: 'center' },
  btnSubmitText: { color: '#0F2D1A', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
});
