import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/lib/useAuthStore'

const categorias = [
  { id: 'eletricista', nome: 'Eletricista', icone: '⚡' },
  { id: 'canalizador', nome: 'Canalizador', icone: '🔧' },
  { id: 'pintor', nome: 'Pintor', icone: '🎨' },
  { id: 'carpinteiro', nome: 'Carpinteiro', icone: '🪚' },
  { id: 'jardineiro', nome: 'Jardineiro', icone: '🌿' },
  { id: 'limpeza', nome: 'Limpeza', icone: '🧹' },
  { id: 'mudancas', nome: 'Mudanças', icone: '📦' },
  { id: 'outros', nome: 'Outros', icone: '🔨' },
]

export default function PesquisarScreen() {
  const [query, setQuery] = useState('')
  const { user, signOut } = useAuthStore()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Pesquisar mestres</Text>
        {user && (
          <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="O que precisas? (ex: instalar tomada, pintar quarto...)"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="sentences"
      />

      <Text style={styles.sectionTitle}>Categorias populares</Text>

      <View style={styles.categoriesGrid}>
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryCard}
            onPress={() => router.push(`/pedido/novo?categoria=${cat.id}`)}
          >
            <Text style={styles.categoryIcon}>{cat.icone}</Text>
            <Text style={styles.categoryName}>{cat.nome}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

import { useState } from 'react'

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
    marginBottom: 24,
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
  searchInput: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#F2C94C',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8E8E8',
  },
  categoryIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
})