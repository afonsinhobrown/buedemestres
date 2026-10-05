import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native'
import { useState } from 'react'

export default function ProHomeScreen() {
  const [isOnline, setIsOnline] = useState(false)

  const toggleOnline = () => {
    setIsOnline(prev => !prev)
    // TODO: Atualizar provider_presence na DB via Supabase
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
