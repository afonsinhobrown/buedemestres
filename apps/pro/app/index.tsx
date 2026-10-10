import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Platform, Modal, Animated } from 'react-native'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

export default function ProHomeScreen() {
  const [isOnline, setIsOnline] = useState(false)
  const [newRequest, setNewRequest] = useState<any>(null)
  const [trabalhosHoje, setTrabalhosHoje] = useState(0)
  const [pendingJobs, setPendingJobs] = useState<any[]>([])
  const user = useAuthStore(s => s.user)

  // Fetch initial pending jobs
  useEffect(() => {
    if (!user) return
    const fetchJobs = async () => {
      const { data } = await supabase
        .from('service_jobs')
        .select('*')
        .eq('provider_id', user.id)
        .eq('status', 'pending')
      if (data) setPendingJobs(data)
    }
    fetchJobs()
  }, [user])

  // Ouve novos pedidos na base de dados em tempo real
  useEffect(() => {
    if (!isOnline) {
      setNewRequest(null);
      return;
    }

    const channel = supabase
      .channel('pro_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_requests' },
        (payload) => {
          console.log('🚨 RECEBIDO NOVO PEDIDO URGENTE:', payload);
          setNewRequest(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_jobs' },
        (payload) => {
          console.log('🚨 RECEBIDO NOVO PEDIDO DIRECTO:', payload);
          if (payload.new.provider_id === user?.id) {
            setNewRequest(payload.new);
            setPendingJobs(prev => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, user]);

  const aceitarTrabalho = async (requestId: string) => {
    // We try to update both tables since we don't know which one it came from
    await supabase.from('service_requests').update({ status: 'accepted' }).eq('id', requestId);
    await supabase.from('service_jobs').update({ status: 'accepted' }).eq('id', requestId);
    
    setNewRequest(null);
    setPendingJobs(prev => prev.filter(job => job.id !== requestId));
    setTrabalhosHoje(prev => prev + 1);
    
    if (Platform.OS !== 'web') {
      Alert.alert('Trabalho aceite!', 'O cliente foi notificado.');
    } else {
      console.log('Trabalho aceite! Estatística atualizada.');
    }
  }

  const toggleOnline = async () => {
    const newValue = !isOnline;
    setIsOnline(newValue)
    
    if (user) {
      // Tenta atualizar a presença. Pode falhar se o perfil não existir, mas para o teste chega.
      await supabase.from('provider_presence').upsert({
        provider_id: user.id,
        is_online: newValue,
        updated_at: new Date().toISOString()
      }, { onConflict: 'provider_id' });
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: isOnline ? '#0F2D1A' : '#1A1A2E' }]}>
      <Text style={styles.logo}>🔨 Bué de Mestres Pro</Text>

      {/* Modal Elegante para o Novo Pedido */}
      <Modal visible={!!newRequest} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Pedido Disponível</Text>
              <Text style={styles.pulseIndicator}>🟢</Text>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalCategory}>{newRequest?.title || 'Serviço Solicitado'}</Text>
              <Text style={styles.modalDescription}>
                {newRequest?.description || 'O cliente precisa da sua ajuda nesta área o mais rápido possível.'}
              </Text>
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceText}>📍 Na sua área</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnRecusar} onPress={() => setNewRequest(null)}>
                <Text style={styles.btnRecusarText}>Recusar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAceitar} onPress={() => aceitarTrabalho(newRequest?.id)}>
                <Text style={styles.btnAceitarText}>ACEITAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>Estado</Text>
            <Text style={[styles.statusValue, { color: isOnline ? '#4ADE80' : '#9CA3AF' }]}>
              {isOnline ? '● Online' : '○ Offline'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={toggleOnline}
            trackColor={{ false: '#374151', true: '#166534' }}
            thumbColor={isOnline ? '#4ADE80' : '#9CA3AF'}
          />
        </View>

        {isOnline && (
          <Text style={styles.onlineHint}>
            A receber pedidos na tua área. Mantém o GPS activo.
          </Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{trabalhosHoje}</Text>
          <Text style={styles.statLabel}>Hoje</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>MT 0</Text>
          <Text style={styles.statLabel}>Ganhos</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>—</Text>
          <Text style={styles.statLabel}>Nota</Text>
        </View>
      </View>

      </View>

      <View style={{ marginTop: 24, flex: 1 }}>
        <Text style={{ color: '#9CA3AF', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 }}>
          Pedidos Pendentes ({pendingJobs.length})
        </Text>
        
        {pendingJobs.length === 0 ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 24, borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: '#6B7280', fontSize: 16 }}>Nenhum pedido pendente.</Text>
          </View>
        ) : (
          pendingJobs.map(job => (
            <View key={job.id} style={{ backgroundColor: '#1E293B', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: 'bold' }}>Novo Pedido Directo</Text>
              <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>Aguardando confirmação</Text>
              <TouchableOpacity 
                style={{ backgroundColor: '#4ADE80', padding: 12, borderRadius: 6, marginTop: 12, alignItems: 'center' }}
                onPress={() => aceitarTrabalho(job.id)}
              >
                <Text style={{ color: '#0F2D1A', fontWeight: 'bold' }}>ACEITAR SERVIÇO</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 64,
  },
  logo: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F5F0E8',
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pulseIndicator: {
    fontSize: 12,
  },
  modalBody: {
    marginBottom: 28,
  },
  modalCategory: {
    color: '#F5F0E8',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalDescription: {
    color: '#D1D5DB',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  distanceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242, 201, 76, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  distanceText: {
    color: '#F2C94C',
    fontSize: 13,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnRecusar: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  btnRecusarText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnAceitar: {
    flex: 2,
    backgroundColor: '#4ADE80',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAceitarText: {
    color: '#0F2D1A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  onlineHint: {
    marginTop: 12,
    color: '#4ADE80',
    fontSize: 13,
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statNumber: {
    color: '#F2C94C',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  btnVerificacao: {
    backgroundColor: '#F2C94C',
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A2E',
  },
  btnVerificacaoText: {
    color: '#1A1A2E',
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
