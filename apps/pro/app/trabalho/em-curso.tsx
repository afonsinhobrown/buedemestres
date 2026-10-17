import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function EmCursoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; offerId?: string }>();
  const jobId = params.jobId || params.offerId || '';
  const [isFinishing, setIsFinishing] = useState(false);

  const finishJob = async () => {
    try {
      setIsFinishing(true);

      if (jobId) {
        const { data: job } = await supabase
          .from('jobs')
          .select('id, request_id, client_id, provider_id')
          .or(`id.eq.${jobId},request_id.eq.${jobId}`)
          .maybeSingle();

        await supabase
          .from('jobs')
          .update({
            status: 'awaiting_confirmation',
            updated_at: new Date().toISOString()
          })
          .or(`id.eq.${jobId},request_id.eq.${jobId}`);

        if (job?.request_id) {
          await supabase
            .from('service_requests')
            .update({
              status: 'in_progress',
              updated_at: new Date().toISOString()
            })
            .eq('id', job.request_id);
        }

        if (job?.client_id) {
          await supabase.from('notifications').insert({
            profile_id: job.client_id,
            type: 'job_finished',
            title: 'O mestre terminou o serviço',
            body: 'Verifica o trabalho e confirma a conclusão para libertar o pagamento retido.',
            data: { job_id: job.id }
          });
        }
      }

      Alert.alert(
        'Serviço Terminado',
        'O cliente foi notificado para verificar e confirmar a conclusão. O pagamento só é libertado depois dessa confirmação.',
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    } catch (error: any) {
      console.warn('Erro ao concluir:', error);
      Alert.alert('Erro', 'Não foi possível registar a conclusão do serviço. Tenta novamente.');
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={{ fontSize: 36 }}>🛠️</Text>
        </View>
        <Text style={styles.title}>Serviço em Execução</Text>
        <Text style={styles.sub}>
          O orçamento foi acordado e o pagamento está retido com segurança na plataforma.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>INSTRUÇÕES DA PLATAFORMA:</Text>
        <Text style={styles.infoItem}>• Todo o processo é acompanhado no sistema.</Text>
        <Text style={styles.infoItem}>• Se surgirem peças extras, propõe um aditamento no sistema.</Text>
        <Text style={styles.infoItem}>• Conclui o serviço para o cliente validar e libertar o pagamento retido.</Text>
      </View>

      <TouchableOpacity 
        onPress={finishJob}
        disabled={isFinishing}
        style={[styles.btnConcluir, isFinishing && { opacity: 0.7 }]}
        activeOpacity={0.8}
      >
        <Text style={styles.btnConcluirText}>
          {isFinishing ? 'A Concluir...' : '✓ Concluir Serviço'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A', padding: 24, justifyContent: 'space-between', paddingTop: 64 },
  header: { alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 2, borderColor: '#4ADE80', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '900', color: '#F5F0E8', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  infoCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  infoTitle: { fontSize: 11, fontWeight: '800', color: '#F2C94C', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  infoItem: { fontSize: 13, color: '#E2E8F0', marginBottom: 8, lineHeight: 18 },
  btnConcluir: { backgroundColor: '#166534', borderRadius: 8, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: '#4ADE80', marginBottom: 24 },
  btnConcluirText: { color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
});
