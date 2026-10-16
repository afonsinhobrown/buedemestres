import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AguardarPagamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; offerId?: string }>();
  const jobId = params.jobId || params.offerId || '';

  const [status, setStatus] = useState<'pending' | 'held' | 'puxado' | 'rejected'>('pending');
  const [feedback, setFeedback] = useState<string>('');
  const [propostaValor, setPropostaValor] = useState<number>(0);

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
            setTimeout(() => {
              router.replace(`/trabalho/em-curso?jobId=${jobId}`);
            }, 1800);
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

        // Verificar jobs
        const { data: job } = await supabase
          .from('jobs')
          .select('status, price_proposed, price_estimate_min')
          .or(`id.eq.${jobId},request_id.eq.${jobId}`)
          .maybeSingle();

        if (job) {
          if (job.status === 'price_agreed' || job.status === 'in_service' || job.status === 'in_progress') {
            setStatus('held');
            setTimeout(() => {
              router.replace(`/trabalho/em-curso?jobId=${jobId}`);
            }, 1800);
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar estado:', err);
      }
    };

    verificarEstado();
    pollTimer = setInterval(verificarEstado, 2000);

    // Canal Realtime para resposta instantânea do cliente
    const channel = supabase
      .channel(`pro_wait_${jobId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_price_proposals' },
        (payload: any) => {
          console.log('Realtime proposta change:', payload);
          verificarEstado();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return (
    <View style={styles.container}>
      {status === 'pending' && (
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <ActivityIndicator size="large" color="#F2C94C" />
          </View>
          <Text style={styles.title}>Aguardar Decisão do Cliente</Text>
          <Text style={styles.sub}>
            A proposta de MT {propostaValor ? propostaValor.toLocaleString('pt-MZ') : '...'} foi enviada para o aplicativo do cliente.
          </Text>
          <View style={styles.optionsPreview}>
            <Text style={styles.optionsTitle}>OPÇÕES DO CLIENTE NO SISTEMA:</Text>
            <Text style={styles.optionItem}>✓ <Text style={{ fontWeight: 'bold' }}>Concordo</Text> — Aceita e retém o valor</Text>
            <Text style={styles.optionItem}>💬 <Text style={{ fontWeight: 'bold' }}>Está puxado</Text> — Pede desconto ou contra-oferta</Text>
            <Text style={styles.optionItem}>✕ <Text style={{ fontWeight: 'bold' }}>Não concordo</Text> — Rejeita orçamento</Text>
          </View>
          <Text style={styles.hint}>
            Sem necessidade de telefonar. O sistema actualiza automaticamente assim que o cliente responder.
          </Text>
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
            O cliente não concordou com este orçamento. Podes propor uma alternativa ou cancelar.
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

      {status === 'held' && (
        <View style={[styles.card, { borderColor: '#4ADE80', borderWidth: 2 }]}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>🔒</Text>
          <Text style={[styles.title, { color: '#4ADE80' }]}>Acordo Fechado!</Text>
          <Text style={[styles.sub, { color: '#E2E8F0' }]}>
            O cliente concordou! O pagamento ficou retido na plataforma (Escrow).
          </Text>
          <View style={{ backgroundColor: 'rgba(74, 222, 128, 0.15)', padding: 12, borderRadius: 8, marginTop: 8 }}>
            <Text style={{ color: '#4ADE80', fontWeight: 'bold', textAlign: 'center' }}>
              ✓ Dinheiro garantido. Podes iniciar o serviço.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A', padding: 24, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 24, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(242,201,76,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900', color: '#F5F0E8', textAlign: 'center', marginBottom: 10 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  optionsPreview: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 16, width: '100%', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  optionsTitle: { fontSize: 10, fontWeight: '800', color: '#F2C94C', letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase' },
  optionItem: { color: '#E2E8F0', fontSize: 13, marginBottom: 6 },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 16 },
  feedbackBoxText: { color: '#F5F0E8', fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 20, lineHeight: 20, backgroundColor: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, width: '100%' },
  btnAjustar: { backgroundColor: '#F59E0B', borderRadius: 8, paddingVertical: 16, paddingHorizontal: 20, width: '100%', alignItems: 'center' },
  btnAjustarText: { color: '#1A1A2E', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
});
