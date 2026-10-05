import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Dimensions } from 'react-native'
import { router } from 'expo-router'

const { width } = Dimensions.get('window')

const placasPrincipais = [
  { id: 'eletricista', nome: 'Eletricista', bg: '#2444C8', text: '#FFFFFF', border: '#12163A' },
  { id: 'canalizador', nome: 'Canalizador', bg: '#FFC61A', text: '#12163A', border: '#12163A' },
  { id: 'mecanico', nome: 'Mecânico', bg: '#BF3A21', text: '#FFFFFF', border: '#12163A' },
  { id: 'pedreiro', nome: 'Pedreiro', bg: '#FFFFFF', text: '#12163A', border: '#2444C8', innerBorder: true },
]

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF0F2" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        <View style={styles.header}>
          <Text style={styles.greeting}>Bom dia,</Text>
          <Text style={styles.logo}>Bué de Mestres</Text>
        </View>

        <TouchableOpacity 
          style={styles.searchBar} 
          onPress={() => router.push('/pesquisar')}
          activeOpacity={0.9}
        >
          <View style={styles.searchSquare} />
          <Text style={styles.searchText}>O que precisas de arranjar hoje?</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Serviços Rápidos</Text>
          <TouchableOpacity onPress={() => router.push('/categorias')}>
            <Text style={styles.seeAll}>Ver tudo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.placasGrid}>
          {placasPrincipais.map((placa, index) => {
            // Rotação pseudo-aleatória fixa por índice para o efeito de "placa pendurada"
            const rotation = index % 2 === 0 ? '-1deg' : '1deg'
            
            return (
              <TouchableOpacity 
                key={placa.id}
                style={[
                  styles.placaContainer, 
                  { backgroundColor: placa.bg, borderColor: placa.border, transform: [{ rotate: rotation }] }
                ]}
                onPress={() => router.push(`/pedido/novo?categoria=${placa.id}`)}
                activeOpacity={0.8}
              >
                {placa.innerBorder && <View style={[styles.innerMoldura, { borderColor: placa.border }]} />}
                <Text style={[styles.placaText, { color: placa.text }]}>
                  {placa.nome.toUpperCase()}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.promoCard}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>Mestres Verificados</Text>
            <Text style={styles.promoDesc}>Todos os profissionais passam por verificação de identidade e qualidade.</Text>
            <TouchableOpacity style={styles.promoBtn} onPress={() => router.push('/categorias')}>
              <Text style={styles.promoBtnText}>Pedir Agora</Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  greeting: {
    fontSize: 17,
    color: '#5B6472', // Zinco
    marginBottom: 4,
  },
  logo: {
    fontSize: 33, // text-2xl/3xl aprox
    fontWeight: '900',
    color: '#12163A', // Tinta
    letterSpacing: -1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Papel
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 2,
    borderColor: '#12163A', // Tinta
    marginBottom: 40,
    shadowColor: '#12163A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  searchSquare: {
    width: 12,
    height: 12,
    backgroundColor: '#2444C8', // Cobalto
    marginRight: 16,
  },
  searchText: {
    fontSize: 17,
    color: '#5B6472',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#12163A',
  },
  seeAll: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2444C8',
  },
  placasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  placaContainer: {
    width: (width - 48 - 16) / 2, // 2 columns with gap
    height: 80,
    borderRadius: 4, // radius-placa
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 8,
  },
  innerMoldura: {
    ...StyleSheet.absoluteFillObject,
    margin: 4,
    borderWidth: 2,
    borderRadius: 2,
  },
  placaText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  promoCard: {
    backgroundColor: '#1A329A', // Cobalto 700
    borderRadius: 10,
    padding: 24,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#12163A',
  },
  promoContent: {
    alignItems: 'flex-start',
  },
  promoTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFC61A', // Amarelo
    marginBottom: 8,
  },
  promoDesc: {
    fontSize: 15,
    color: '#DCE3FA', // Cobalto 100
    marginBottom: 24,
    lineHeight: 22,
  },
  promoBtn: {
    backgroundColor: '#FFC61A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#12163A',
  },
  promoBtnText: {
    color: '#12163A',
    fontWeight: '800',
    fontSize: 15,
  },
})
