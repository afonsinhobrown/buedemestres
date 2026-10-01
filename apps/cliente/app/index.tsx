import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🔨 Bué de Mestres</Text>
      <Text style={styles.tagline}>O mestre certo, onde precisas.</Text>

      <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/pesquisar')}>
        <Text style={styles.btnText}>Preciso de um mestre</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/categorias')}>
        <Text style={styles.btnTextSecondary}>Ver categorias</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1A1A2E',
    marginBottom: 8,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: '#5C5C7A',
    marginBottom: 48,
    textAlign: 'center',
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#1A1A2E',
    borderRadius: 6,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#F2C94C',
  },
  btnText: {
    color: '#F5F0E8',
    fontWeight: '800',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  btnSecondary: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A2E',
  },
  btnTextSecondary: {
    color: '#1A1A2E',
    fontWeight: '700',
    fontSize: 15,
  },
})
