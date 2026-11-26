import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/lib/useAuthStore'
import { useState } from 'react'

const categorias = [
  { id: 'eletricista', nome: 'Eletricista', icone: '⚡', bg: '#2444C8', text: '#FFFFFF', border: '#12163A' },
  { id: 'canalizador', nome: 'Canalizador', icone: '🔧', bg: '#FFC61A', text: '#12163A', border: '#12163A' },
  { id: 'pintor', nome: 'Pintor', icone: '🎨', bg: '#FFFFFF', text: '#12163A', border: '#2444C8', innerBorder: true },
  { id: 'carpinteiro', nome: 'Carpinteiro', icone: '🪚', bg: '#BF3A21', text: '#FFFFFF', border: '#12163A' },
]

export default function PesquisarScreen() {
  const [query, setQuery] = useState('')
  const { user, signOut } = useAuthStore()

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF0F2" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Pesquisar</Text>
          {user ? (
            <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Ex: instalar tomada, pintar..."
          placeholderTextColor="#5B6472"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="sentences"
          autoFocus
        />

        <Text style={styles.sectionTitle}>Mais procurados</Text>

        <View style={styles.categoriesGrid}>
          {categorias.map((cat, index) => {
            const rotation = index % 2 === 0 ? '-1deg' : '1deg'
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryCard,
                  { backgroundColor: cat.bg, borderColor: cat.border, transform: [{ rotate: rotation }] }
                ]}
                onPress={() => router.push(`/pedido/novo?categoria=${cat.id}`)}
                activeOpacity={0.8}
              >
                {cat.innerBorder && <View style={[styles.innerMoldura, { borderColor: cat.border }]} />}
                <Text style={[styles.categoryIcon, { color: cat.text }]}>{cat.icone}</Text>
                <Text style={[styles.categoryName, { color: cat.text }]}>{cat.nome}</Text>
              </TouchableOpacity>
            )
          })}
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
    marginBottom: 24,
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
    fontSize: 21,
    fontWeight: '900',
    color: '#12163A', // Tinta
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
  searchInput: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#12163A',
    borderWidth: 2,
    borderColor: '#2444C8', // Cobalto em vez de Amarelo para focus/default
    marginBottom: 32,
    shadowColor: '#12163A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#12163A',
    marginBottom: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 16,
    minHeight: 100,
  },
  innerMoldura: {
    ...StyleSheet.absoluteFillObject,
    margin: 4,
    borderWidth: 2,
    borderRadius: 2,
  },
  categoryIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
})