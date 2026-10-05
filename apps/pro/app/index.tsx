import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Platform } from 'react-native'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

export default function ProHomeScreen() {
  const [isOnline, setIsOnline] = useState(false)
  const [newRequest, setNewRequest] = useState<any>(null)
  const user = useAuthStore(s => s.user)

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
          console.log('🚨 RECEBIDO NOVO PEDIDO NO SUPABASE:', payload);
          setNewRequest(payload.new); // Mostra no ecrã imediatamente
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline]);

  const aceitarTrabalho = async (requestId: string) => {
    await supabase.from('service_requests').update({ status: 'accepted' }).eq('id', requestId);
    setNewRequest(null);
    if (Platform.OS !== 'web') {
      Alert.alert('Trabalho aceite!', 'O cliente foi notificado.');
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

  if (newRequest) {
    return (
      <View style={[styles.container, { backgroundColor: '#EF4444', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 40, color: 'white', fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>
          🚨 NOVO TRABALHO!
        </Text>
        <Text style={{ fontSize: 24, color: 'white', textAlign: 'center', marginBottom: 40 }}>
          {newRequest.description || 'Alguém precisa dos seus serviços agora!'}
        </Text>
        <TouchableOpacity 
          style={{ backgroundColor: 'white', padding: 20, borderRadius: 10, marginBottom: 20 }}
          onPress={() => aceitarTrabalho(newRequest.id)}
        >
          <Text style={{ color: '#EF4444', fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
            ACEITAR TRABALHO
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ backgroundColor: 'transparent', padding: 20, borderRadius: 10, borderWidth: 2, borderColor: 'white' }}
          onPress={() => setNewRequest(null)}
        >
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
            RECUSAR
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isOnline ? '#0F2D1A' : '#1A1A2E' }]}>
      <Text style={styles.logo}>🔨 Bué de Mestres Pro</Text>

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
          <Text style={styles.statNumber}>0</Text>
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

      <TouchableOpacity style={styles.btnVerificacao}>
        <Text style={styles.btnVerificacaoText}>Completar Verificação →</Text>
      </TouchableOpacity>
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
})
