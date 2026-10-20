import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { Alert } from '../../lib/alertCompat'
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { API_BASE } from '../../lib/api';

export default function AguardarPagamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; offerId?: string; valor?: string }>();
  const jobId = params.jobId || params.offerId || '';

  const [status, setStatus] = useState<'pending' | 'held' | 'puxado' | 'rejected' | 'expirado' | 'payment_failed'>('pending');
  const [feedback, setFeedback] = useState<string>('');
  const [propostaValor, setPropostaValor] = useState<number>(params.valor ? parseFloat(params.valor) : 0);
  const [contraPropostaValor, setContraPropostaValor] = useState<number>(0);
  const [turnoExpiraEm, setTurnoExpiraEm] = useState<number | null>(null);
  const [segundosTurno, setSegundosTurno] = useState<number | null>(null);

  // Relógio do turno (conta decrescente)
  useEffect(() => {
    if (!turnoExpiraEm) {
      setSegundosTurno(null);
      return;
    }
    const tick = () => setSegundosTurno(Math.max(0, Math.round((turnoExpiraEm - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [turnoExpiraEm]);

  useEffect(() => {
    if (!jobId) return;

    let pollTimer: NodeJS.Timeout;

    // Fecha negociações vencidas (o cron também o faz; aqui é imediato)
    supabase.rpc('expire_stale_negotiations').then(() => {}, () => {});

    const verificarEstado = async () => {
      try {
        // 1. Obter job mapeando ambos os IDs (job.id e job.request_id)
        const { data: job } = await supabase
          .from('jobs')
          .select('id, request_id, status, price_proposed, price_estimate_min, agreed_amount, cancel_reason, turn_expires_at, turn_owner, negotiation_rounds')
          .or(`id.eq.${jobId},request_id.eq.${jobId}`)
          .maybeSingle();

        const actualJobId = job?.id || jobId;
        const actualReqId = job?.request_id || jobId;

        // Negociação expirada => estado terminal
        if (job?.status === 'cancelled' && String(job?.cancel_reason || '').startsWith('expirado')) {
          setStatus('expirado');
          setTurnoExpiraEm(null);
          return;
        }

        // Relógio do turno actual
        setTurnoExpiraEm(job?.turn_expires_at ? new Date(job.turn_expires_at).getTime() : null);

        // 2. Verificar estado no service_request
        const { data: req } = await supabase
          .from('service_requests')
          .select('status, budget_max')
          .or(`id.eq.${actualReqId},id.eq.${actualJobId}`)
          .maybeSingle();

        // Detectar se o cliente pediu revisão / contra-proposta
        if (job?.status === 'puxado' || req?.status === 'puxado' || (job?.price_estimate_min && job.price_estimate_min > 0)) {
          setStatus('puxado');
          const cp = job?.price_estimate_min || req?.budget_max || 0;
          if (cp) setContraPropostaValor(cp);
        }

        // 3. Verificar propostas por ambos os IDs
        const { data: prop } = await supabase
          .from('job_price_proposals')
          .select('*')
          .or(`job_id.eq.${actualJobId},job_id.eq.${actualReqId}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prop) {
          if (prop.amount && status !== 'puxado' && !job?.price_estimate_min) {
            setPropostaValor(prop.amount);
          }
          if (prop.status === 'accepted') {
            setStatus('held');
            return;
          } else if (prop.status === 'rejected') {
            setStatus('rejected');
            return;
          } else if (prop.description && prop.description.includes('[ESTÁ PUXADO')) {
            setStatus('puxado');
            setFeedback(prop.description);
            if (prop.amount) setContraPropostaValor(prop.amount);
            return;
          }
        }

        if (job) {
          if (job.status === 'price_agreed' || job.status === 'in_service' || job.status === 'en_route') {
            setStatus('held');
            if (job.agreed_amount) setPropostaValor(job.agreed_amount);
            return;
          }
        }

        // A tentativa de pagamento foi cancelada/recusada: parar o spinner.
        const { data: payment } = await supabase
          .from('job_payments')
          .select('status')
          .eq('job_id', actualJobId)
          .maybeSingle();

        if (payment?.status === 'failed') {
          setStatus('payment_failed');
        } else if (payment?.status === 'pending_payment' && status === 'payment_failed') {
          // O cliente iniciou uma nova tentativa de pagamento.
          setStatus('pending');
        }
      } catch (err) {
        console.warn('Erro ao verificar estado:', err);
      }
    };

    verificarEstado();
    pollTimer = setInterval(verificarEstado, 2000);

    const channel = supabase
      .channel(`pro_wait_${jobId}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_price_proposals' }, () => verificarEstado())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => verificarEstado())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => verificarEstado())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_payments' }, () => verificarEstado())
      .subscribe();

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [jobId, status]);

  // Reconciliação activa: se o cliente fechou a aba depois de pagar, o mestre
  // também pede à PaySuite para verificar e o endpoint confirma na base de dados.
  useEffect(() => {
    if (!jobId) return;

    const reconciliar = async () => {
      try {
        await fetch(`${API_BASE}/api/payments/status?jobId=${encodeURIComponent(jobId)}`);
      } catch {
        // rede instável — o polling à base de dados continua a tentar
      }
    };

    reconciliar();
    const t = setInterval(reconciliar, 15000);
    return () => {
      clearInterval(t);
    };
  }, [jobId]);

  const handleAceitarContraProposta = async () => {
    try {
      const valorFinal = contraPropostaValor || propostaValor;

      const { data: job } = await supabase
        .from('jobs')
        .select('id, request_id, provider_id, client_id')
        .or(`id.eq.${jobId},request_id.eq.${jobId}`)
        .maybeSingle();

      const jId = job?.id || jobId;
      const rId = job?.request_id || jobId;

      await supabase
        .from('job_price_proposals')
        .insert({
          job_id: jId,
          proposed_by: job?.provider_id,
          amount: valorFinal,
          description: `Acordo fechado: Mestre aceitou a contra-proposta de MT ${valorFinal}`,
          status: 'pending'
        });

      await supabase
        .from('jobs')
        .update({
          status: 'price_proposed',
          price_proposed: valorFinal,
          price_estimate_min: null,
          updated_at: new Date().toISOString()
        })
        .or(`id.eq.${jId},request_id.eq.${rId}`);

      await supabase
        .from('service_requests')
        .update({
          status: 'price_proposed',
          budget_max: valorFinal,
          updated_at: new Date().toISOString()
        })
        .or(`id.eq.${rId},id.eq.${jId}`);

      // Passa o turno ao cliente (o cliente confirma e paga) com prazo
      await supabase.rpc('set_negotiation_turn', {
        p_job: jId,
        p_owner: 'client',
        p_is_counter: false
      });

      setPropostaValor(valorFinal);
      setStatus('pending');
      Alert.alert('Contra-proposta Aceite!', `Aceitaste o valor de MT ${valorFinal}. O cliente já pode efectuar o pagamento retido em segurança.`);
    } catch (e: any) {
      console.error('Erro ao aceitar contra-proposta:', e);
      Alert.alert('Erro', e.message || 'Erro ao aceitar contra-proposta.');
    }
  };

  const handleIniciarDeslocacao = () => {
    router.push({
      pathname: '/trabalho/a-caminho',
      params: { jobId, valorAcordado: propostaValor.toString() }
    });
  };

  const tempoTurno = segundosTurno != null
    ? `${Math.floor(segundosTurno / 60)}:${String(segundosTurno % 60).padStart(2, '0')}`
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {status === 'expirado' && (
        <View style={[styles.card, { borderColor: '#EF4444', borderWidth: 2 }]}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>⌛</Text>
          <Text style={[styles.title, { color: '#F87171' }]}>Negociação Expirada</Text>
          <Text style={styles.sub}>
            O prazo terminou sem acordo. O pedido foi reaberto para outros profissionais e não ficou retido.
          </Text>
          <TouchableOpacity
            style={styles.btnAjustar}
            onPress={() => router.replace('/')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAjustarText}>Voltar ao Início</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'payment_failed' && (
        <View style={[styles.card, { borderColor: '#EF4444', borderWidth: 2 }]}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
          <Text style={[styles.title, { color: '#F87171' }]}>Pagamento Não Concluído</Text>
          <Text style={styles.sub}>
            O cliente cancelou ou não concluiu o pagamento de MT{' '}
            {propostaValor ? propostaValor.toLocaleString('pt-MZ') : '...'}. O valor ainda não está retido — não
            inicies a deslocação. Se o cliente tentar novamente, este ecrã actualiza sozinho.
          </Text>
          <TouchableOpacity
            style={styles.btnAjustar}
            onPress={() => router.replace('/trabalhos')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAjustarText}>Voltar aos Meus Trabalhos</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'pending' && (
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <ActivityIndicator size="large" color="#F2C94C" />
          </View>
          <Text style={styles.title}>Aguardar Acordo & Pagamento</Text>
          <Text style={styles.sub}>
            A proposta de MT {propostaValor ? propostaValor.toLocaleString('pt-MZ') : '...'} foi enviada para o aplicativo do cliente.
          </Text>
          {tempoTurno && <Text style={styles.turnoText}>⏱ Resposta do cliente: {tempoTurno}</Text>}

          <View style={styles.regraSegurancaBox}>
            <Text style={styles.regraSegurancaTitulo}>🛑 ATENÇÃO: NÃO SAIA DO SEU LOCAL AINDA</Text>
            <Text style={styles.regraSegurancaTexto}>
              O mestre só deve iniciar a deslocação depois de a plataforma confirmar que o cliente concordou e o pagamento está retido em segurança (Escrow).
            </Text>
          </View>

          <View style={styles.optionsPreview}>
            <Text style={styles.optionsTitle}>OPÇÕES DO CLIENTE NO SISTEMA:</Text>
            <Text style={styles.optionItem}>✓ <Text style={{ fontWeight: 'bold' }}>Concordo</Text> — Paga e o valor fica retido</Text>
            <Text style={styles.optionItem}>💬 <Text style={{ fontWeight: 'bold' }}>Está puxado</Text> — Pede desconto ou contra-oferta</Text>
            <Text style={styles.optionItem}>✕ <Text style={{ fontWeight: 'bold' }}>Não concordo</Text> — Rejeita orçamento</Text>
          </View>

          <TouchableOpacity
            style={styles.btnChat}
            onPress={() => router.push({ pathname: '/chat', params: { jobId } })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnChatText}>💬 Falar com o Cliente</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'puxado' && (
        <View style={[styles.card, { borderColor: '#F59E0B', borderWidth: 2.5, backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
          <Text style={{ fontSize: 52, marginBottom: 8 }}>💬</Text>
          <Text style={[styles.title, { color: '#F59E0B' }]}>O Cliente Achou Puxado!</Text>
          
          <View style={styles.counterOfferBox}>
            <Text style={styles.counterOfferLabel}>CONTRA-PROPOSTA DO CLIENTE:</Text>
            <Text style={styles.counterOfferValue}>
              MT {contraPropostaValor ? contraPropostaValor.toLocaleString('pt-MZ') : '...'}
            </Text>
            {feedback ? (
              <Text style={styles.counterOfferNote}>"{feedback}"</Text>
            ) : null}
          </View>

          <Text style={styles.counterOfferSub}>
            Podes aceitar o valor proposto pelo cliente para fechar logo o acordo ou enviar uma nova proposta ajustada.
          </Text>
          {tempoTurno && <Text style={styles.turnoText}>⏱ Tens {tempoTurno} para responder</Text>}

          <View style={styles.counterActionsRow}>
            {contraPropostaValor > 0 && (
              <TouchableOpacity 
                style={styles.btnAceitarContra}
                onPress={handleAceitarContraProposta}
                activeOpacity={0.8}
              >
                <Text style={styles.btnAceitarContraText}>✓ Aceitar MT {contraPropostaValor.toLocaleString('pt-MZ')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.btnAjustar, contraPropostaValor > 0 && { marginTop: 10 }]}
              onPress={() => router.push(`/trabalho/propor-preco?jobId=${jobId}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnAjustarText}>✏️ Fazer Nova Proposta de Preço</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {status === 'rejected' && (
        <View style={[styles.card, { borderColor: '#EF4444', borderWidth: 2 }]}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>✕</Text>
          <Text style={[styles.title, { color: '#EF4444' }]}>Proposta Não Aceite</Text>
          <Text style={styles.sub}>
            O cliente não concordou com este orçamento. Podes propor uma alternativa ou aguardar novo pedido.
          </Text>
          <TouchableOpacity 
            style={[styles.btnAjustar, { backgroundColor: '#334155', borderColor: '#64748B' }]}
            onPress={() => router.push(`/trabalho/propor-preco?jobId=${jobId}`)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAjustarText}>Fazer Nova Proposta</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SÓ QUANDO O CLIENTE PAGA É QUE LIBERTA A PARTIDA! */}
      {status === 'held' && (
        <View style={[styles.card, { borderColor: '#4ADE80', borderWidth: 2, backgroundColor: 'rgba(22, 101, 52, 0.4)' }]}>
          <Text style={{ fontSize: 56, marginBottom: 10 }}>🔒</Text>
          <Text style={[styles.title, { color: '#4ADE80' }]}>PAGAMENTO RETIDO!</Text>
          <Text style={[styles.sub, { color: '#E2E8F0', marginBottom: 16 }]}>
            O cliente concordou com o orçamento de MT {propostaValor.toLocaleString('pt-MZ')} e o pagamento está garantido na plataforma (Escrow).
          </Text>

          <View style={{ backgroundColor: 'rgba(74, 222, 128, 0.15)', padding: 14, borderRadius: 8, width: '100%', marginBottom: 20 }}>
            <Text style={{ color: '#4ADE80', fontWeight: 'bold', textAlign: 'center', fontSize: 13 }}>
              ✓ Dinheiro garantido. Já podes partir com confiança!
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.btnPartir}
            onPress={handleIniciarDeslocacao}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPartirText}>🚗 Indicar Transporte e Partir →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingTop: 48 },
  card: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 24, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(242,201,76,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 22, fontWeight: '900', color: '#F5F0E8', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  regraSegurancaBox: { backgroundColor: 'rgba(239, 68, 68, 0.18)', borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 8, padding: 12, marginBottom: 16, width: '100%' },
  regraSegurancaTitulo: { color: '#F87171', fontWeight: '900', fontSize: 11, letterSpacing: 0.5, marginBottom: 4 },
  regraSegurancaTexto: { color: '#FCA5A5', fontSize: 12, lineHeight: 17 },
  optionsPreview: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 14, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  optionsTitle: { fontSize: 10, fontWeight: '800', color: '#F2C94C', letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase' },
  optionItem: { color: '#E2E8F0', fontSize: 12, marginBottom: 4 },

  counterOfferBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
    borderWidth: 2,
    borderColor: '#D97706',
  },
  counterOfferLabel: { fontSize: 11, fontWeight: '900', color: '#92400E', letterSpacing: 1 },
  counterOfferValue: { fontSize: 32, fontWeight: '900', color: '#78350F', marginVertical: 4 },
  counterOfferNote: { fontSize: 12, color: '#92400E', fontStyle: 'italic', textAlign: 'center' },
  counterOfferSub: { fontSize: 13, color: '#E2E8F0', textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  turnoText: { color: '#F2C94C', fontWeight: '900', fontSize: 13, textAlign: 'center', marginBottom: 12 },

  counterActionsRow: { width: '100%' },
  btnAceitarContra: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#15803D',
  },
  btnAceitarContraText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15, textTransform: 'uppercase' },
  btnAjustar: { backgroundColor: '#F59E0B', borderRadius: 8, paddingVertical: 15, width: '100%', alignItems: 'center' },
  btnAjustarText: { color: '#1A1A2E', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnPartir: { backgroundColor: '#4ADE80', borderRadius: 8, paddingVertical: 18, paddingHorizontal: 20, width: '100%', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  btnPartirText: { color: '#0F2D1A', fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnChat: { marginTop: 14, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  btnChatText: { color: '#F2C94C', fontWeight: '900', fontSize: 13 },
});
