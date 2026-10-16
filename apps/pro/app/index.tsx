import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Platform, Modal, TextInput, ActivityIndicator, Image } from 'react-native'
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

  // Carregar dados do Mestre e sua Especialidade/Categoria Real com Join da tabela categories
  useEffect(() => {
    async function carregarPerfilMestre() {
      try {
        const { data: provs, error } = await supabase
          .from('provider_profiles')
          .select(`
            profile_id,
            business_name,
            primary_category_id,
            is_available,
            categories:primary_category_id (
              id,
              name,
              slug
            )
          `)
          .eq('is_published', true)
          .limit(10)
        
        if (provs && provs.length > 0) {
          setAvailableProviders(provs)
          const matched = provs.find(p => p.profile_id === user?.id) || provs[0]
          
          // Carregar dados de avatar/nome de profiles directamente
          const { data: profData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', matched.profile_id)
            .maybeSingle()

          const profileCompleto = {
            ...matched,
            profiles: profData || {
              full_name: matched.business_name || 'Provedor 1',
              avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
            }
          }

          setProviderProfile(profileCompleto)
          setIsOnline(true)
          
          await supabase.from('provider_presence').upsert({
            provider_id: matched.profile_id,
            is_online: true,
            categories: matched.primary_category_id ? [matched.primary_category_id] : [2],
            updated_at: new Date().toISOString()
          }, { onConflict: 'provider_id' })
        } else if (error) {
          console.error('Erro ao carregar provedores reais:', error)
        }
      } catch (err) {
        console.error('Excepção ao carregar perfil do mestre:', err)
      }
    }
    carregarPerfilMestre()
  }, [user])

  // Manter heartbeat de presença enquanto online (PostGIS requer updated_at recente)
  useEffect(() => {
    if (!isOnline || !providerProfile) return

    const proId = providerProfile.profile_id
    const catId = providerProfile.primary_category_id

    const heartbeat = setInterval(async () => {
      await supabase.from('provider_presence').upsert({
        provider_id: proId,
        is_online: true,
        categories: catId ? [catId] : [2],
        updated_at: new Date().toISOString()
      }, { onConflict: 'provider_id' })
    }, 40000)

    return () => clearInterval(heartbeat)
  }, [isOnline, providerProfile])

  // Busca e actualização constante de pedidos (Polling activo a cada 2.5s + Realtime)
  useEffect(() => {
    if (!isOnline || !providerProfile) {
      setNewRequest(null)
      return
    }

    const activeProId = providerProfile.profile_id
    const activeCatId = providerProfile.primary_category_id

    const pollPedidos = async () => {
      try {
        // 1. Pedidos directos para este mestre
        const { data: jobs } = await supabase
          .from('service_jobs')
          .select('*')
          .eq('provider_id', activeProId)
          .eq('status', 'pending')

        // 2. Pedidos urgentes abertos da especialidade
        let reqQuery = supabase
          .from('service_requests')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false })

        if (activeCatId) {
          reqQuery = reqQuery.eq('category_id', activeCatId)
        }

        const { data: requests, error } = await reqQuery

        if (!error && requests && requests.length > 0) {
          const todos = [...(jobs || []), ...requests]
          setPendingJobs(todos)
          // Se ainda não estiver a exibir um pedido no modal, abre imediatamente o mais recente!
          setNewRequest(current => {
            if (current) return current
            return requests[0]
          })
        } else {
          setPendingJobs(jobs || [])
          setNewRequest(null)
        }
      } catch (err) {
        console.warn('Erro ao sondar pedidos:', err)
      }
    }

    // Executa imediatamente e a cada 2.5 segundos
    pollPedidos()
    const pollInterval = setInterval(pollPedidos, 2500)

    // Subscrição Realtime com ID único para notificação instantânea (sub-segundo)
    const channelId = `pro_realtime_${activeProId}_${Date.now()}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_requests' },
        (payload) => {
          if (activeCatId && payload.new.category_id && Number(payload.new.category_id) !== Number(activeCatId)) {
            return
          }
          console.log('🚨 RECEBIDO NOVO PEDIDO URGENTE VIA REALTIME:', payload.new)
          setNewRequest(payload.new)
          setPendingJobs(prev => [payload.new, ...prev.filter(j => j.id !== payload.new.id)])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests' },
        (payload) => {
          if (payload.new.status !== 'open') {
            setPendingJobs(prev => prev.filter(j => j.id !== payload.new.id))
            setNewRequest((curr: any) => (curr?.id === payload.new.id ? null : curr))
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Pro Realtime Status [${channelId}]:`, status)
      })

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [isOnline, providerProfile])

  const aceitarTrabalho = async (req: any) => {
    const requestId = typeof req === 'string' ? req : req.id
    const jobTitle = typeof req === 'object' ? (req.title || req.problem_description || 'Serviço') : 'Serviço'
    const activeProId = providerProfile?.profile_id || user?.id

    // 1. Atualizar o pedido para status 'accepted' com target_provider_id
    const { error: reqErr } = await supabase
      .from('service_requests')
      .update({
        status: 'accepted',
        target_provider_id: activeProId
      })
      .eq('id', requestId)

    if (reqErr) {
      console.error('Erro ao aceitar pedido:', reqErr)
    }

    // 2. Registar em jobs se existir
    try {
      await supabase.from('jobs').upsert({
        request_id: requestId,
        client_id: req?.client_id || '11111111-1111-1111-1111-111111111111',
        provider_id: activeProId,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      }, { onConflict: 'request_id' })
    } catch (e) {
      console.warn('Jobs upsert:', e)
    }

    // 3. Atualizar presença com timestamp recente
    if (activeProId) {
      await supabase
        .from('provider_presence')
        .update({ updated_at: new Date().toISOString() })
        .eq('provider_id', activeProId)
    }

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
    
    const proId = providerProfile?.profile_id || user?.id
    const catId = providerProfile?.primary_category_id
    if (proId) {
      await supabase.from('provider_presence').upsert({
        provider_id: proId,
        is_online: newValue,
        categories: catId ? [catId] : [2],
        updated_at: new Date().toISOString()
      }, { onConflict: 'provider_id' });
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: isOnline ? '#0F2D1A' : '#1A1A2E' }]}>
      <View style={{ marginBottom: 24 }}>
        {/* Barra de Perfil do Mestre Sempre Visível */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image
              source={{ uri: (providerProfile?.profiles as any)?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' }}
              style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#F2C94C', backgroundColor: '#334155' }}
            />
            <View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
                {providerProfile?.business_name || (providerProfile?.profiles as any)?.full_name || 'Provedor 1'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ backgroundColor: '#F2C94C', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#1A1A2E', fontWeight: '900', fontSize: 10 }}>
                    {providerProfile?.categories?.name || 'Mecânico'}
                  </Text>
                </View>
                <Text style={{ color: isOnline ? '#4ADE80' : '#94A3B8', fontSize: 11, fontWeight: '700' }}>
                  {isOnline ? '🟢 Online (Disponível)' : '⚪ Pausa'}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Switch
              value={isOnline}
              onValueChange={toggleOnline}
              trackColor={{ false: '#334155', true: '#22c55e' }}
              thumbColor={isOnline ? '#fff' : '#cbd5e1'}
            />
            <Text style={{ color: '#cbd5e1', fontSize: 9, marginTop: 2, fontWeight: '800' }}>
              {isOnline ? 'ACTIVO' : 'PAUSA'}
            </Text>
          </View>
        </View>

        <Text style={styles.logo}>🔨 Bué de Mestres Pro</Text>

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
              <TouchableOpacity style={styles.btnAceitar} onPress={() => aceitarTrabalho(newRequest)}>
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
