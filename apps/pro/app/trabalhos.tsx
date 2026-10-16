import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/useAuthStore';

const ACTIVE_STATUSES = ['accepted', 'price_proposed', 'puxado', 'price_agreed', 'en_route', 'arrived', 'in_service'];

type JobRow = {
  id: string;
  request_id: string | null;
  status: string;
  price_proposed: number | null;
  price_estimate_min: number | null;
  agreed_amount: number | null;
  turn_owner: string | null;
  turn_expires_at: string | null;
  negotiation_state: string | null;
  service_requests?: { title?: string; budget_max?: number | null; urgency?: string } | null;
};

const STATUS_INFO: Record<string, { label: string; emoji: string; color: string; hint: string }> = {
  accepted: { label: 'Aceite — propor orçamento', emoji: '📝', color: '#38BDF8', hint: 'Envia o teu orçamento ao cliente' },
  price_proposed: { label: 'Orçamento enviado', emoji: '⏳', color: '#F2C94C', hint: 'À espera da resposta do cliente' },
  puxado: { label: 'Negociação "Está Puxado"', emoji: '💬', color: '#F59E0B', hint: 'O cliente fez uma contra-proposta' },
  price_agreed: { label: 'Acordo fechado', emoji: '🔒', color: '#4ADE80', hint: 'Pagamento retido em segurança' },
  en_route: { label: 'A caminho', emoji: '🚗', color: '#60A5FA', hint: 'Deslocação em curso' },
  arrived: { label: 'No local', emoji: '📍', color: '#A78BFA', hint: 'Chegaste ao cliente' },
  in_service: { label: 'Serviço em curso', emoji: '🔧', color: '#4ADE80', hint: 'Trabalho a decorrer' },
};

function statusInfo(s: string) {
  return STATUS_INFO[s] || { label: s, emoji: '•', color: '#94A3B8', hint: '' };
}

export default function TrabalhosScreen() {
  const router = useRouter();
  const user = useAuthStore((s: any) => s.user);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [proId, setProId] = useState<string | null>(null);

  const resolverProvider = useCallback(async () => {
    const { data: provs } = await supabase
      .from('provider_profiles')
      .select('profile_id')
      .eq('is_published', true)
      .limit(10);
    const matched = (provs || []).find((p: any) => p.profile_id === user?.id) || (provs || [])[0];
    return matched?.profile_id || null;
  }, [user]);

  const carregar = useCallback(async (providerId: string) => {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, request_id, status, price_proposed, price_estimate_min, agreed_amount, turn_owner, turn_expires_at, negotiation_state, service_requests:request_id ( title, budget_max, urgency )')
      .eq('provider_id', providerId)
      .in('status', ACTIVE_STATUSES)
      .order('updated_at', { ascending: false });
    if (error) console.warn('Erro ao carregar trabalhos:', error.message);
    setJobs((data as JobRow[]) || []);
  }, []);

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const providerId = await resolverProvider();
      if (!providerId) {
        setLoading(false);
        return;
      }
      setProId(providerId);
      await supabase.rpc('expire_stale_negotiations').then(() => {}, () => {});
      await carregar(providerId);
      setLoading(false);

      pollTimer = setInterval(() => carregar(providerId), 3000);
      channel = supabase
        .channel(`pro_jobs_${providerId}_${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => carregar(providerId))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_price_proposals' }, () => carregar(providerId))
        .subscribe();
    })();

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [resolverProvider, carregar]);

  const abrir = (job: JobRow) => {
    const target = job.request_id || job.id;
    if (job.status === 'accepted') {
      router.push(`/trabalho/propor-preco?jobId=${target}`);
    } else if (job.status === 'en_route' || job.status === 'arrived') {
      router.push(`/trabalho/a-caminho?jobId=${job.id}`);
    } else if (job.status === 'in_service') {
      router.push(`/trabalho/em-curso?jobId=${job.id}`);
    } else {
      router.push(`/trabalho/aguardar-pagamento?jobId=${job.id}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Os Meus Trabalhos</Text>
        <Text style={styles.sub}>Tudo o que está em curso contigo. Toque para continuar.</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F2C94C" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
          {jobs.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🛠️</Text>
              <Text style={styles.emptyTitle}>Nenhum trabalho em curso</Text>
              <Text style={styles.emptyDesc}>Quando aceitares um pedido, ele aparece aqui — mesmo depois de sair do ecrã.</Text>
            </View>
          ) : (
            jobs.map((job) => {
              const info = statusInfo(job.status);
              const titulo = job.service_requests?.title || 'Serviço';
              const valor = job.agreed_amount ?? job.price_proposed ?? job.price_estimate_min;
              return (
                <TouchableOpacity
                  key={job.id}
                  style={[styles.card, { borderLeftColor: info.color }]}
                  onPress={() => abrir(job)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardEmoji}>{info.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{titulo}</Text>
                      <Text style={[styles.cardStatus, { color: info.color }]}>{info.label}</Text>
                    </View>
                    {valor ? (
                      <Text style={styles.cardValor}>
                        MT {Number(valor).toLocaleString('pt-MZ')}
                      </Text>
                    ) : null}
                  </View>
                  {info.hint ? <Text style={styles.cardHint}>{info.hint}</Text> : null}
                  <Text style={styles.cardCta}>Abrir →</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A' },
  header: { paddingTop: 48, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#F2C94C', fontWeight: '800', fontSize: 13 },
  title: { fontSize: 24, fontWeight: '900', color: '#F5F0E8' },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  empty: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 28, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  emptyTitle: { color: '#F5F0E8', fontSize: 16, fontWeight: '900', marginBottom: 6 },
  emptyDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 16, marginBottom: 12, borderLeftWidth: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardEmoji: { fontSize: 26 },
  cardTitle: { color: '#F5F0E8', fontSize: 15, fontWeight: '900' },
  cardStatus: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  cardValor: { color: '#F2C94C', fontSize: 16, fontWeight: '900' },
  cardHint: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 8 },
  cardCta: { color: '#4ADE80', fontSize: 12, fontWeight: '900', marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
});
