import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/lib/useAuthStore'

const categorias = [
  { id: 'eletricista', nome: 'Eletricista', icone: '⚡', desc: 'Instalações, reparos, quadros elétricos' },
  { id: 'canalizador', nome: 'Canalizador', icone: '🔧', desc: 'Vazamentos, desentupimentos, instalações' },
  { id: 'pintor', nome: 'Pintor', icone: '🎨', desc: 'Interiores, exteriores, retoques' },
  { id: 'carpinteiro', nome: 'Carpinteiro', icone: '🪚', desc: 'Móveis, portas, decks, reparos em madeira' },
  { id: 'jardineiro', nome: 'Jardineiro', icone: '🌿', desc: 'Poda, plantio, manutenção, paisagismo' },
  { id: 'limpeza', nome: 'Limpeza', icone: '🧹', desc: 'Residencial, pós-obra, escritórios' },
  { id: 'mudancas', nome: 'Mudanças', icone: '📦', desc: 'Transporte, embalagem, montagem' },
  { id: 'outros', nome: 'Outros serviços', icone: '🔨', desc: 'Pequenos reparos, montagens, instalações' },
]

export default function CategoriasScreen() {
  const { user, signOut } = useAuthStore()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Categorias</Text>
        {user && (
          <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.subtitle}>Escolhe o tipo de serviço que precisas</Text>

      <View style={styles.list}>
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryCard}
            onPress={() => router.push(`/pedido/novo?categoria=${cat.id}`)}
            activeOpacity={0.8}
          >
            <View style={styles.iconWrapper}>
              <Text style={styles.categoryIcon}>{cat.icone}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.categoryName}>{cat.nome}</Text>
              <Text style={styles.categoryDesc}>{cat.desc}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A1A2E',
    letterSpacing: -1,
  },
  logoutBtn: {
    backgroundColor: '#E74C3C',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  subtitle: {
    fontSize: 15,
    color: '#5C5C7A',
    marginBottom: 24,
  },
  list: {
    gap: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E8E8E8',
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#F5F0E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  categoryIcon: {
    fontSize: 24,
  },
  info: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  categoryDesc: {
    fontSize: 13,
    color: '#5C5C7A',
  },
  arrow: {
    fontSize: 24,
    color: '#A0A0A0',
    fontWeight: '300',
  },
})