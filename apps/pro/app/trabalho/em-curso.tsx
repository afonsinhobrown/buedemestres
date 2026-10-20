import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { Alert } from '../../lib/alertCompat'
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

import { API_BASE } from '@/lib/api'

export default function EmCursoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; offerId?: string }>();
  const jobId = params.jobId || params.offerId || '';
  const [isFinishing, setIsFinishing] = useState(false);
  const [realJobId, setRealJobId] = useState('');
  const [addendum, setAddendum] = useState<any>(null);
  const [addendumAberto, setAddendumAberto] = useState(false);
  const [addendumValor, setAddendumValor] = useState('');
  const [addendumDescricao, setAddendumDescricao] = useState('');
  const [addendumSubmetendo, setAddendumSubmetendo] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    let timer: NodeJS.Timeout;

    const carregar = async () => {
      const { data: job } = await supabase
        .from('jobs')
        .select('id')
        .or(`id.eq.${jobId},request_id.eq.${jobId}`)
        .maybeSingle();

      if (job?.id) {
        setRealJobId(job.id);
        const { data: addenda } = await supabase
          .from('job_addenda')
          .select('*')
          .eq('job_id', job.id)
          .order('created_at', { ascending: false })
          .limit(1);
        setAddendum(addenda?.[0] || null);
      }
    };

    carregar();
    timer = setInterval(carregar, 5000);
    return () => clearInterval(timer);
  }, [jobId]);

  const pedirAditamento = async () => {
    const amount = parseFloat(addendumValor);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Valor invÃ¡lido', 'Indica o valor adicional a cobrar ao cliente.');
      return;
    }
    if (addendumDescricao.trim().length < 3) {
      Alert.alert('DescriÃ§Ã£o', 'Explica o trabalho adicional que encontraste.');
      return;
    }

    try {
      setAddendumSubmetendo(true);
      const res = await fetch(`${API_BASE}/api/payments/addendum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: realJobId || jobId,
          amount,
          description: addendumDescricao.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'NÃ£o foi possÃ­vel pedir o aditamento.');
      }
      setAddendumAberto(false);
      setAddendumValor('');
      setAddendumDescricao('');
      Alert.alert('Aditamento enviado', 'O cliente foi notificado para pagar o valor adicional.');
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao pedir o aditamento.');
    } finally {
      setAddendumSubmetendo(false);
    }
  };

  const concluirServico = async () => {
    try {
      setIsFinishing(true)
      const agora = new Date().toISOString()
      const { data: job, error } = await supabase
        .from('jobs')
        .update({ status: 'awaiting_confirmation', updated_at: agora })
        .or(`id.eq.${jobId},request_id.eq.${jobId}`)
        .eq('status', 'in_service')
        .select('id, request_id, client_id')
        .maybeSingle();

      if (error) throw error;
      if (!job) {
        Alert.alert('Já concluído', 'Este serviço já não está em execução.', [
          { text: 'OK', onPress: () => router.replace('/trabalhos') },
        ]);
        return;
      }

      if (job.request_id) {
        await supabase
          .from('service_requests')
          .update({ status: 'in_progress', updated_at: agora })
          .eq('id', job.request_id);

        await supabase.from('notifications').insert({
          profile_id: job.client_id,
          type: 'service_finished',
          title: 'Serviço concluído',
          body: 'O mestre terminou o serviço. Confirma a conclusão para libertar o pagamento.',
          data: { jobId: job.id, requestId: job.request_id },
        });
      }

      Alert.alert('Serviço concluído', 'O cliente foi notificado para confirmar a conclusão e libertar o pagamento.', [
        { text: 'OK', onPress: () => router.replace('/trabalhos') },
      ]);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível concluir o serviço.');
    } finally {
      setIsFinishing(false);
    }
  };

  const finishJob = () => {
    Alert.alert(
      'Concluir serviço',
      'Confirmas que já terminaste o trabalho? O cliente será notificado para confirmar e libertar o pagamento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sim, concluí', onPress: concluirServico },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={{ fontSize: 36 }}>ðŸ› ï¸</Text>
        </View>
        <Text style={styles.title}>ServiÃ§o em ExecuÃ§Ã£o</Text>
        <Text style={styles.sub}>
          O orÃ§amento foi acordado e o pagamento estÃ¡ retido com seguranÃ§a na plataforma.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>INSTRUÃ‡Ã•ES DA PLATAFORMA:</Text>
        <Text style={styles.infoItem}>â€¢ Todo o processo Ã© acompanhado no sistema.</Text>
        <Text style={styles.infoItem}>â€¢ Se surgirem peÃ§as extras, propÃµe um aditamento no sistema.</Text>
        <Text style={styles.infoItem}>â€¢ Conclui o serviÃ§o para o cliente validar e libertar o pagamento retido.</Text>
      </View>

      <View style={styles.addendumCard}>
        <Text style={styles.addendumTitle}>ADITAMENTO DE ORÃ‡AMENTO</Text>
        {addendum ? (
          <Text style={styles.addendumStatus}>
            {addendum.status === 'held' || addendum.status === 'released'
              ? `âœ“ Aditamento de MT ${Number(addendum.amount).toLocaleString('pt-MZ')} pago e retido.`
              : addendum.status === 'failed'
              ? `O aditamento de MT ${Number(addendum.amount).toLocaleString('pt-MZ')} nÃ£o foi pago.`
              : `â³ Ã€ espera do pagamento de MT ${Number(addendum.amount).toLocaleString('pt-MZ')} pelo cliente.`}
          </Text>
        ) : (
          <Text style={styles.addendumStatus}>O trabalho Ã© maior do que foi descrito? Pede o valor adicional.</Text>
        )}

        {(!addendum || addendum.status === 'failed') && !addendumAberto && (
          <TouchableOpacity style={styles.btnAditamento} onPress={() => setAddendumAberto(true)} activeOpacity={0.8}>
            <Text style={styles.btnAditamentoText}>+ Pedir Aditamento ao Cliente</Text>
          </TouchableOpacity>
        )}

        {addendumAberto && (
          <View style={{ marginTop: 10 }}>
            <TextInput
              style={styles.input}
              placeholder="Valor adicional (MT)"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={addendumValor}
              onChangeText={setAddendumValor}
            />
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              placeholder="Descreve o trabalho adicional encontrado..."
              placeholderTextColor="#94A3B8"
              value={addendumDescricao}
              onChangeText={setAddendumDescricao}
              multiline
            />
            <TouchableOpacity
              style={[styles.btnAditamento, addendumSubmetendo && { opacity: 0.6 }]}
              onPress={pedirAditamento}
              disabled={addendumSubmetendo}
            >
              <Text style={styles.btnAditamentoText}>
                {addendumSubmetendo ? 'A enviar...' : 'Enviar Aditamento'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAddendumAberto(false)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: '#94A3B8', textAlign: 'center', fontSize: 12, fontWeight: '700' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.btnChat}
        onPress={() => router.push({ pathname: '/chat', params: { jobId } })}
        activeOpacity={0.8}
      >
        <Text style={styles.btnChatText}>ðŸ’¬ Falar com o Cliente</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={finishJob}
        disabled={isFinishing}
        style={[styles.btnConcluir, isFinishing && { opacity: 0.7 }]}
        activeOpacity={0.8}
      >
        <Text style={styles.btnConcluirText}>
          {isFinishing ? 'A concluir...' : '✅ Confirmar que terminei o serviço'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A' },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between', padding: 24, paddingTop: 64, paddingBottom: 40 },
  header: { alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 2, borderColor: '#4ADE80', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '900', color: '#F5F0E8', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  infoCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  infoTitle: { fontSize: 11, fontWeight: '800', color: '#F2C94C', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  infoItem: { fontSize: 13, color: '#E2E8F0', marginBottom: 8, lineHeight: 18 },
  addendumCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(242,201,76,0.3)', marginVertical: 12 },
  addendumTitle: { fontSize: 10, fontWeight: '900', color: '#F2C94C', letterSpacing: 1, marginBottom: 6 },
  addendumStatus: { fontSize: 12, color: '#E2E8F0', lineHeight: 18, marginBottom: 8 },
  btnAditamento: { backgroundColor: '#F2C94C', borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  btnAditamentoText: { color: '#1A1A2E', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginBottom: 8 },
  btnChat: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 12 },
  btnChatText: { color: '#F2C94C', fontWeight: '900', fontSize: 13 },
  btnConcluir: { backgroundColor: '#166534', borderRadius: 8, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: '#4ADE80', marginBottom: 24 },
  btnConcluirText: { color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
});
