import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Platform, Modal, TextInput, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

export default function ProHomeScreen() {
  const [isOnline, setIsOnline] = useState(false)
  const [newRequest, setNewRequest] = useState<any>(null)
  const [trabalhosHoje, setTrabalhosHoje] = useState(0)
  const [pendingJobs, setPendingJobs] = useState<any[]>([])
  const [providerProfile, setProviderProfile] = useState<any>(null)
  const [availableProviders, setAvailableProviders] = useState<any[]>([])
  const user = useAuthStore(s => s.user)

  // Carregar dados do Mestre e sua Especialidade/Categoria
  useEffect(() => {
    async function carregarPerfilMestre() {
      // 1. Tentar carregar provedores da base de dados
      const { data: provs } = await supabase
        .from('provider_profiles')
        .select('profile_id, business_name, category_id, categories(name)')
        .limit(10)
      
      if (provs && provs.length > 0) {
        setAvailableProviders(provs)
        // Se user logado corresponder, usar esse, senão usar o primeiro como default ativo
        const matched = provs.find(p => p.profile_id === user?.id) || provs[0]
        setProviderProfile(matched)
      } else {
        // Fallback default mestre mecânico
        setProviderProfile({
          profile_id: user?.id || 'demo-pro',
          business_name: 'Oficina Central (Mecânico)',
          category_id: 1,
          categories: { name: 'Mecânico' }
        })
      }
    }
    carregarPerfilMestre()
  }, [user])

  // Fetch initial pending jobs filtrados estritamente pela categoria do mestre
  useEffect(() => {
    if (!providerProfile) return
    const activeProId = providerProfile.profile_id
    const activeCatId = providerProfile.category_id

    const fetchJobs = async () => {
      // Pedidos directos para este mestre
      const { data: jobs } = await supabase
        .from('service_jobs')
        .select('*')
        .eq('provider_id', activeProId)
        .eq('status', 'pending')
        
      // Pedidos abertos APENAS da mesma categoria do mestre
      let reqQuery = supabase
        .from('service_requests')
        .select('*')
        .eq('status', 'open')
        
      if (activeCatId) {
        reqQuery = reqQuery.eq('category_id', activeCatId)
      }
      
      const { data: requests } = await reqQuery
      setPendingJobs([...(jobs || []), ...(requests || [])])
    }
    fetchJobs()
  }, [providerProfile])

  // Ouve novos pedidos em tempo real filtrando pela categoria do mestre
  useEffect(() => {
    if (!isOnline || !providerProfile) {
      setNewRequest(null)
      return
    }

    const activeProId = providerProfile.profile_id
    const activeCatId = providerProfile.category_id

    const channel = supabase
      .channel('pro_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_requests' },
        (payload) => {
          // FILTRO: Só notifica se for da mesma categoria do mestre!
          if (activeCatId && payload.new.category_id && payload.new.category_id !== activeCatId) {
            console.log(`Ignorado pedido de categoria diferente (${payload.new.category_id}) para mestre da categoria (${activeCatId})`)
            return
          }
          console.log('🚨 RECEBIDO NOVO PEDIDO URGENTE DA MINHA CATEGORIA:', payload)
          setNewRequest(payload.new)
          setPendingJobs(prev => [payload.new, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_jobs' },
        (payload) => {
          if (payload.new.provider_id === activeProId) {
            console.log('🚨 RECEBIDO NOVO PEDIDO DIRECTO:', payload)
            setNewRequest(payload.new)
            setPendingJobs(prev => [payload.new, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOnline, providerProfile])

  const aceitarTrabalho = async (req: any) => {
    const requestId = typeof req === 'string' ? req : req.id
    const jobTitle = typeof req === 'object' ? (req.title || req.problem_description || 'Serviço') : 'Serviço'

    await supabase.from('service_requests').update({ status: 'accepted' }).eq('id', requestId)
    await supabase.from('service_jobs').update({ status: 'accepted' }).eq('id', requestId)
    
    setNewRequest(null)
    setPendingJobs(prev => prev.filter(job => job.id !== requestId))
    setTrabalhosHoje(prev => prev + 1)

    // Navegar imediatamente para o ecrã de deslocação do mestre!
    router.push({
      pathname: '/trabalho/a-caminho',
      params: {
        jobId: requestId,
        categoriaNome: jobTitle,
        categoriaEmoji: '🔧'
      }
    })
  }

  const recusarTrabalho = async (requestId: string) => {
    await supabase.from('service_requests').update({ status: 'cancelled' }).eq('id', requestId);
    await supabase.from('service_jobs').update({ status: 'cancelled' }).eq('id', requestId);
    
    setNewRequest(null);
    setPendingJobs(prev => prev.filter(job => job.id !== requestId));
    
    if (Platform.OS !== 'web') {
      Alert.alert('Pedido recusado', 'O pedido foi recusado.');
    } else {
      console.log('Pedido recusado.');
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
      <View style={{ marginBottom: 24 }}>
        <Text style={styles.logo}>🔨 Bué de Mestres Pro</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -20, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: '#F2C94C', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ color: '#1A1A2E', fontWeight: '900', fontSize: 12 }}>
              Especialidade: {providerProfile?.categories?.name || 'Mecânico'}
            </Text>
          </View>
          <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '700' }}>
            {providerProfile?.business_name || 'Mestre Registado'}
          </Text>
        </View>

        {/* Seletor rápido de Especialidade / Mestre Registado */}
        {availableProviders.length > 1 && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {availableProviders.map(p => (
              <TouchableOpacity
                key={p.profile_id}
                onPress={() => setProviderProfile(p)}
                style={{
                  backgroundColor: providerProfile?.profile_id === p.profile_id ? '#2563EB' : 'rgba(255,255,255,0.08)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: providerProfile?.profile_id === p.profile_id ? '#60A5FA' : 'rgba(255,255,255,0.1)'
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {p.categories?.name || 'Mestre'}: {p.business_name?.substring(0, 15)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
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
              <TouchableOpacity style={styles.btnRecusar} onPress={() => newRequest?.id && recusarTrabalho(newRequest.id)}>
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
      <View style={{ marginTop: 24, flex: 1 }}>
        <Text style={{ color: '#9CA3AF', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 }}>
          Pedidos Pendentes ({pendingJobs.length})
        </Text>
        
        {pendingJobs.length === 0 ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 24, borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: '#6B7280', fontSize: 16 }}>Nenhum pedido pendente para esta especialidade.</Text>
          </View>
        ) : (
          pendingJobs.map(job => (
            <View key={job.id} style={{ backgroundColor: '#1E293B', padding: 16, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: 'bold' }}>
                  {job.title || job.problem_description || 'Pedido de Serviço'}
                </Text>
                <View style={{ backgroundColor: 'rgba(242,201,76,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#F2C94C', fontSize: 11, fontWeight: 'bold' }}>URGENTE</Text>
                </View>
              </View>

              {job.description && (
                <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8, lineHeight: 18 }}>
                  {job.description}
                </Text>
              )}

              {(job.location_note || job.reference_point) && (
                <Text style={{ color: '#38BDF8', fontSize: 12, marginBottom: 12 }}>
                  📍 Ref: {job.location_note || job.reference_point}
                </Text>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#451A1A', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#7F1D1D' }}
                  onPress={() => recusarTrabalho(job.id)}
                >
                  <Text style={{ color: '#FCA5A5', fontWeight: 'bold' }}>RECUSAR</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 2, backgroundColor: '#4ADE80', padding: 12, borderRadius: 6, alignItems: 'center' }}
                  onPress={() => aceitarTrabalho(job)}
                >
                  <Text style={{ color: '#0F2D1A', fontWeight: 'bold' }}>ACEITAR E PARTIR →</Text>
                </TouchableOpacity>
              </View>
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
