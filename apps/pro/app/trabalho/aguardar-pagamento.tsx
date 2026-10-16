import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AguardarPagamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; offerId?: string; valor?: string }>();
  const jobId = params.jobId || params.offerId || '';

  const [status, setStatus] = useState<'pending' | 'held' | 'puxado' | 'rejected'>('pending');
  const [feedback, setFeedback] = useState<string>('');
  const [propostaValor, setPropostaValor] = useState<number>(params.valor ? parseFloat(params.valor) : 0);

  useEffect(() => {
    if (!jobId) return;

    let pollTimer: NodeJS.Timeout;

    const verificarEstado = async () => {
      try {
        // Verificar propostas
        const { data: prop } = await supabase
          .from('job_price_proposals')
          .select('*')
          .or(`job_id.eq.${jobId}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prop) {
          setPropostaValor(prop.amount);
          if (prop.status === 'accepted') {
            setStatus('held');
            return;
          } else if (prop.status === 'rejected') {
            setStatus('rejected');
            return;
          } else if (prop.description && prop.description.includes('[ESTÁ PUXADO')) {
            setStatus('puxado');
            setFeedback(prop.description);
            return;
          }
        }

        // Verificar jobs e pagamentos
        const { data: job } = await supabase
          .from('jobs')
          .select('status, price_proposed, price_estimate_min, agreed_amount')
          .or(`id.eq.${jobId},request_id.eq.${jobId}`)
          .maybeSingle();

        if (job) {
          if (job.status === 'price_agreed' || job.status === 'in_service' || job.status === 'en_route') {
            setStatus('held');
            if (job.agreed_amount) setPropostaValor(job.agreed_amount);
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar estado:', err);
      }
    };

    verificarEstado();
    pollTimer = setInterval(verificarEstado, 2000);

    const channel = supabase
      .channel(`pro_wait_${jobId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_price_proposals' },
        () => verificarEstado()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => verificarEstado()
      )
      .subscribe();

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  const handleIniciarDeslocacao = () => {
    router.push({
      pathname: '/trabalho/a-caminho',
      params: { jobId, valorAcordado: propostaValor.toString() }
    });
  };

  return (
    <View style={styles.container}>
      {status === 'pending' && (
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <ActivityIndicator size="large" color="#F2C94C" />
          </View>
          <Text style={styles.title}>Aguardar Acordo & Pagamento</Text>
          <Text style={styles.sub}>
            A proposta de MT {propostaValor ? propostaValor.toLocaleString('pt-MZ') : '...'} foi enviada para o aplicativo do cliente.
          </Text>

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
        </View>
      )}

      {status === 'puxado' && (
        <View style={[styles.card, { borderColor: '#F59E0B', borderWidth: 2 }]}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
          <Text style={[styles.title, { color: '#F59E0B' }]}>O Cliente Achou Puxado!</Text>
          <Text style={styles.feedbackBoxText}>
            {feedback || 'O cliente solicitou uma revisão do valor para poder fechar o serviço.'}
          </Text>
          <TouchableOpacity 
            style={styles.btnAjustar}
            onPress={() => router.push(`/trabalho/propor-preco?jobId=${jobId}`)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAjustarText}>✏️ Ajustar Preço / Negociar no Sistema</Text>
          </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A', padding: 24, justifyContent: 'center', alignItems: 'center' },
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
  feedbackBoxText: { color: '#F5F0E8', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 18, lineHeight: 18, backgroundColor: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, width: '100%' },
  btnAjustar: { backgroundColor: '#F59E0B', borderRadius: 8, paddingVertical: 16, paddingHorizontal: 20, width: '100%', alignItems: 'center' },
  btnAjustarText: { color: '#1A1A2E', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnPartir: { backgroundColor: '#4ADE80', borderRadius: 8, paddingVertical: 18, paddingHorizontal: 20, width: '100%', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  btnPartirText: { color: '#0F2D1A', fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
});
