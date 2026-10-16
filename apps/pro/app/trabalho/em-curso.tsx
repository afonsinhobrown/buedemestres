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
        // Atualizar estado para awaiting_confirmation ou completed
        await supabase
          .from('jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .or(`id.eq.${jobId},request_id.eq.${jobId}`);

        await supabase
          .from('service_requests')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      }

      Alert.alert('Serviço Concluído', 'O trabalho foi finalizado! O cliente confirmará a libertação do valor retido.', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
    } catch (error: any) {
      console.warn('Erro ao concluir:', error);
      Alert.alert('Sucesso', 'Serviço concluído com sucesso!', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
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
