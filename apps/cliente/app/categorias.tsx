import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/lib/useAuthStore'

const categorias = [
  { id: 'eletricista', nome: 'Eletricista', icone: '⚡', desc: 'Instalações, reparos, quadros elétricos', cor: '#2444C8', text: '#FFF' },
  { id: 'canalizador', nome: 'Canalizador', icone: '🔧', desc: 'Vazamentos, desentupimentos, instalações', cor: '#FFC61A', text: '#12163A' },
  { id: 'pintor', nome: 'Pintor', icone: '🎨', desc: 'Interiores, exteriores, retoques', cor: '#2444C8', text: '#FFF' },
  { id: 'carpinteiro', nome: 'Carpinteiro', icone: '🪚', desc: 'Móveis, portas, decks', cor: '#FFFFFF', text: '#12163A', border: '#2444C8' },
  { id: 'jardineiro', nome: 'Jardineiro', icone: '🌿', desc: 'Poda, plantio, manutenção', cor: '#BF3A21', text: '#FFF' },
  { id: 'limpeza', nome: 'Limpeza', icone: '🧹', desc: 'Residencial, pós-obra, escritórios', cor: '#FFC61A', text: '#12163A' },
  { id: 'mudancas', nome: 'Mudanças', icone: '📦', desc: 'Transporte, embalagem, montagem', cor: '#2444C8', text: '#FFF' },
  { id: 'outros', nome: 'Outros serviços', icone: '🔨', desc: 'Pequenos reparos, montagens', cor: '#FFFFFF', text: '#12163A', border: '#12163A' },
]

export default function CategoriasScreen() {
  const { user, signOut } = useAuthStore()

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF0F2" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Categorias</Text>
          {user ? (
            <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <Text style={styles.subtitle}>Escolhe o tipo de serviço que precisas</Text>

        <View style={styles.list}>
          {categorias.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryCard, 
                { backgroundColor: cat.cor, borderColor: cat.border || '#12163A' }
              ]}
              onPress={() => router.push(`/pedido/novo?categoria=${cat.id}`)}
              activeOpacity={0.9}
            >
              <View style={[styles.iconWrapper, { backgroundColor: cat.cor === '#FFFFFF' ? '#EDF0F2' : 'rgba(255,255,255,0.2)' }]}>
                <Text style={styles.categoryIcon}>{cat.icone}</Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.categoryName, { color: cat.text }]}>{cat.nome.toUpperCase()}</Text>
                <Text style={[styles.categoryDesc, { color: cat.text, opacity: 0.8 }]}>{cat.desc}</Text>
              </View>
              <Text style={[styles.arrow, { color: cat.text }]}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDF0F2', // Cal
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    color: '#12163A',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#12163A',
    letterSpacing: -1,
  },
  logoutBtn: {
    backgroundColor: '#BF3A21',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#12163A',
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  subtitle: {
    fontSize: 17,
    color: '#5B6472',
    marginBottom: 24,
    fontWeight: '500',
  },
  list: {
    gap: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4, // radius-placa
    padding: 16,
    borderWidth: 2,
    shadowColor: '#12163A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 8, // radius-foto
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryIcon: {
    fontSize: 28,
  },
  info: {
    flex: 1,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  categoryDesc: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  arrow: {
    fontSize: 24,
    fontWeight: '900',
    marginLeft: 16,
  },
})