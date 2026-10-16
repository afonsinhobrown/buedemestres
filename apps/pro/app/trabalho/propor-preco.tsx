import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

interface ServiceLine {
  id: string;
  description: string;
  price: string;
}

export default function ProporPrecoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; offerId?: string; transporte?: string }>();
  const targetId = params.jobId || params.offerId || '';

  const [lines, setLines] = useState<ServiceLine[]>([
    { id: '1', description: 'Diagnóstico e mão de obra', price: '800' },
    { id: '2', description: 'Taxa de deslocação', price: '150' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clientFeedback, setClientFeedback] = useState<string | null>(null);
  const [actualJobId, setActualJobId] = useState<string>(targetId);

  useEffect(() => {
    async function loadCurrentJob() {
      if (!targetId) {
        setLoading(false);
        return;
      }
      try {
        const { data: job } = await supabase
          .from('jobs')
          .select('id, request_id, price_proposed, price_estimate_min')
          .or(`id.eq.${targetId},request_id.eq.${targetId}`)
          .maybeSingle();

        if (job) {
          setActualJobId(job.id);
          const { data: prop } = await supabase
            .from('job_price_proposals')
            .select('*')
            .eq('job_id', job.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (prop?.description && prop.description.includes('[ESTÁ PUXADO')) {
            setClientFeedback(prop.description);
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar detalhes do trabalho:', e);
      } finally {
        setLoading(false);
      }
    }
    loadCurrentJob();
  }, [targetId]);

  const addLine = () => {
    setLines([...lines, { id: Math.random().toString(), description: '', price: '' }]);
  };

  const updateLine = (id: string, field: 'description' | 'price', value: string) => {
    setLines(lines.map(line => line.id === id ? { ...line, [field]: value } : line));
  };

  const removeLine = (id: string) => {
    setLines(lines.filter(line => line.id !== id));
  };

  // 1-Clique: Quando a descrição do cliente é diferente ou o cliente não quer fazer o conserto maior
  const handleApenasDeslocacao = () => {
    setLines([
      { id: 'deslocacao_diag', description: 'Taxa de Deslocação e Diagnóstico no Terreno (Problema diferente do descrito)', price: '250' }
    ]);
  };

  const total = lines.reduce((acc, line) => {
    const p = parseFloat(line.price) || 0;
    return acc + p;
  }, 0);

  const submitProposal = async () => {
    try {
      setIsSubmitting(true);
      const validLines = lines.filter(l => l.description.trim() !== '' && parseFloat(l.price) > 0);
      
      if (validLines.length === 0) {
        Alert.alert('Erro', 'Adicione pelo menos um serviço com preço válido.');
        return;
      }

      let jId = actualJobId;
      if (!jId) {
        const { data: req } = await supabase
          .from('service_requests')
          .select('id, client_id')
          .eq('id', targetId)
          .maybeSingle();

        if (req) {
          const { data: createdJob } = await supabase
            .from('jobs')
            .upsert({
              request_id: req.id,
              client_id: req.client_id,
              provider_id: '22222222-2222-2222-2222-222222222222',
              status: 'price_proposed',
              price_proposed: total
            })
            .select()
            .single();

          if (createdJob) jId = createdJob.id;
        }
      }

      if (jId) {
        await supabase.from('job_price_proposals').insert({
          job_id: jId,
          proposed_by: '22222222-2222-2222-2222-222222222222',
          amount: total,
          description: JSON.stringify(validLines),
          status: 'pending'
        });

        await supabase
          .from('jobs')
          .update({
            status: 'price_proposed',
            price_proposed: total
          })
          .eq('id', jId);
      }

      await supabase
        .from('service_requests')
        .update({
          status: 'price_proposed',
          budget_max: total
        })
        .or(`id.eq.${targetId},id.eq.${jId}`);

      router.push(`/trabalho/aguardar-pagamento?jobId=${jId || targetId}`);
    } catch (error: any) {
      console.error('Erro ao enviar proposta:', error);
      Alert.alert('Erro', error.message || 'Ocorreu um erro ao propor o preço.');
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
        <Text style={styles.headerTitle}>Propor Orçamento</Text>
        <Text style={styles.headerSub}>
          Nenhum contacto telefónico. O cliente recebe e decide no sistema.
        </Text>
      </View>

      {/* Alerta de negociação se o cliente tiver achado puxado */}
      {clientFeedback && (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackTitle}>⚠️ NEGOCIAÇÃO EM CURSO COM CLIENTE</Text>
          <Text style={styles.feedbackText}>{clientFeedback}</Text>
          <Text style={styles.feedbackHint}>Ajusta o valor abaixo para fechar o acordo no sistema.</Text>
        </View>
      )}

      {/* Proteção do Mestre: Avaria Diferente no Terreno */}
      <View style={styles.discrepanciaCard}>
        <Text style={styles.discrepanciaLabel}>🚨 ENCONTROU PROBLEMA DIFERENTE DO DESCRITO?</Text>
        <Text style={styles.discrepanciaText}>
          Se a avaria real exigir outro profissional/oficina ou se o cliente recusar a reparação maior, cobre apenas a deslocação e diagnóstico presencial para não ficar no prejuízo.
        </Text>
        <TouchableOpacity 
          style={styles.btnApenasDeslocacao}
          onPress={handleApenasDeslocacao}
          activeOpacity={0.8}
        >
          <Text style={styles.btnApenasDeslocacaoText}>
            ⚡ Aplicar apenas Taxa de Deslocação & Diagnóstico (MT 250)
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        <Text style={styles.sectionLabel}>ITENS DO ORÇAMENTO (DETALHE)</Text>
        {lines.map((line, index) => (
          <View key={line.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemNum}>Item {index + 1}</Text>
              {lines.length > 1 && (
                <TouchableOpacity onPress={() => removeLine(line.id)}>
                  <Text style={styles.removerText}>Remover ✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={styles.inputDesc}
              placeholder="Ex: Diagnóstico, mão de obra, filtro..."
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

        <View style={styles.totalCard}>
          <View>
            <Text style={styles.totalLabel}>TOTAL DO ORÇAMENTO</Text>
            <Text style={styles.totalNota}>Valor a reter na plataforma (Escrow)</Text>
          </View>
          <Text style={styles.totalValor}>MT {total.toLocaleString('pt-MZ')}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>🔒</Text>
          <Text style={styles.infoText}>
            O cliente poderá escolher: "Concordo", "Não concordo" ou "Está puxado". Se o cliente concordar, o valor é retido imediatamente na plataforma para a tua segurança.
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity 
        onPress={submitProposal}
        disabled={isSubmitting}
        style={[styles.btnSubmit, isSubmitting && { opacity: 0.7 }]}
        activeOpacity={0.8}
      >
        <Text style={styles.btnSubmitText}>
          {isSubmitting ? 'A Enviar Proposta...' : `Enviar Orçamento (MT ${total.toLocaleString('pt-MZ')}) →`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A', padding: 20, paddingTop: 48 },
  header: { marginBottom: 14 },
  backBtn: { marginBottom: 6 },
  backBtnText: { color: '#F2C94C', fontWeight: '800', fontSize: 13 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#F5F0E8', marginBottom: 2 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  discrepanciaCard: { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 8, padding: 12, marginBottom: 14 },
  discrepanciaLabel: { color: '#F87171', fontWeight: '900', fontSize: 11, letterSpacing: 0.5, marginBottom: 4 },
  discrepanciaText: { color: '#FCA5A5', fontSize: 12, lineHeight: 16, marginBottom: 8 },
  btnApenasDeslocacao: { backgroundColor: '#B91C1C', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' },
  btnApenasDeslocacaoText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  feedbackBanner: { backgroundColor: 'rgba(242, 201, 76, 0.15)', borderWidth: 1.5, borderColor: '#F2C94C', borderRadius: 8, padding: 12, marginBottom: 14 },
  feedbackTitle: { color: '#F2C94C', fontWeight: '900', fontSize: 11, letterSpacing: 0.5, marginBottom: 4 },
  feedbackText: { color: '#F5F0E8', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  feedbackHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  itemCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemNum: { fontSize: 11, fontWeight: '800', color: '#F2C94C', textTransform: 'uppercase' },
  removerText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  inputDesc: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 10, color: '#fff', fontSize: 13, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  priceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10 },
  currencyPrefix: { color: '#F2C94C', fontWeight: '900', fontSize: 15, marginRight: 8 },
  inputPrice: { flex: 1, paddingVertical: 8, color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnAddLine: { paddingVertical: 10, alignItems: 'center', borderRadius: 6, borderWidth: 1.5, borderColor: '#38BDF8', borderStyle: 'dashed', backgroundColor: 'rgba(56, 189, 248, 0.08)', marginBottom: 14 },
  btnAddLineText: { color: '#38BDF8', fontWeight: '800', fontSize: 12 },
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#F2C94C', marginBottom: 14 },
  totalLabel: { fontSize: 11, fontWeight: '900', color: '#F2C94C', textTransform: 'uppercase', letterSpacing: 1 },
  totalNota: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  totalValor: { fontSize: 22, fontWeight: '900', color: '#F5F0E8' },
  infoBox: { flexDirection: 'row', gap: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 16 },
  infoIcon: { fontSize: 18 },
  infoText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 16 },
  btnSubmit: { backgroundColor: '#4ADE80', borderRadius: 8, paddingVertical: 16, alignItems: 'center' },
  btnSubmitText: { color: '#0F2D1A', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
});
