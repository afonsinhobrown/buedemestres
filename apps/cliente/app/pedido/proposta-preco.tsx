import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState } from 'react'

// Ecrã onde o mestre propõe o preço e o cliente aceita e paga
export default function PropostaPrecoScreen() {
  const params = useLocalSearchParams<{
    jobId: string
    mestreNome: string
    categoriaEmoji: string
  }>()

  const [aceite, setAceite] = useState(false)
  const [pagamentoFeito, setPagamentoFeito] = useState(false)

  // Valores de demo (em produção vêm da DB via Realtime)
  const linhas = [
    { descricao: 'Diagnóstico e mão de obra', valor: 800 },
    { descricao: 'Óleo de motor (2L)', valor: 400 },
    { descricao: 'Taxa de deslocação', valor: 150 },
  ]
  const total = linhas.reduce((s, l) => s + l.valor, 0)

  const handleAceitar = () => {
    Alert.alert(
      'Confirmar e pagar',
      `Pagas MT ${total.toLocaleString('pt-MZ')} via M-Pesa. O valor fica retido até confirmares que o serviço foi concluído.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pagar agora',
          style: 'default',
          onPress: () => {
            setAceite(true)
            // TODO: chamar agree_price() + iniciar pagamento M-Pesa
            setTimeout(() => {
              setPagamentoFeito(true)
            }, 2000)
          }
        }
      ]
    )
  }

  if (pagamentoFeito) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>🔒</Text>
        <Text style={styles.successTitle}>Pagamento retido!</Text>
        <Text style={styles.successDesc}>
          MT {total.toLocaleString('pt-MZ')} está guardado na plataforma. Só será libertado ao mestre quando confirmares que o serviço foi bem feito.
        </Text>
        <View style={styles.successCard}>
          <Text style={styles.successCardLabel}>O mestre sabe que foi pago</Text>
          <Text style={styles.successCardSub}>Pode começar o serviço com confiança.</Text>
        </View>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push({ pathname: '/pedido/confirmar', params: { jobId: params.jobId } })}
        >
          <Text style={styles.btnText}>Acompanhar serviço →</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Proposta de preço</Text>
        <Text style={styles.headerSub}>
          {params.categoriaEmoji ?? '🔧'} {params.mestreNome ?? 'Mestre'} · Chegou ao local
        </Text>
      </View>

      <View style={styles.tabela}>
        <Text style={styles.tabelaLabel}>DETALHE DO ORÇAMENTO</Text>
        {linhas.map((l, i) => (
          <View key={i} style={styles.tabelaLinha}>
            <Text style={styles.tabelaDescricao}>{l.descricao}</Text>
            <Text style={styles.tabelaValor}>MT {l.valor.toLocaleString('pt-MZ')}</Text>
          </View>
        ))}
        <View style={styles.tabelaTotal}>
          <Text style={styles.tabelaTotalLabel}>TOTAL</Text>
          <Text style={styles.tabelaTotalValor}>MT {total.toLocaleString('pt-MZ')}</Text>
        </View>
      </View>

      <View style={styles.escrowInfo}>
        <Text style={styles.escrowIcon}>🔒</Text>
        <Text style={styles.escrowText}>
          O valor fica retido na plataforma e só é libertado ao mestre quando confirmares que o serviço foi concluído com sucesso.
        </Text>
      </View>

      <TouchableOpacity style={styles.btnPrimary} onPress={handleAceitar}>
        <Text style={styles.btnText}>✓ Aceitar e pagar MT {total.toLocaleString('pt-MZ')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnRecusar}>
        <Text style={styles.btnRecusarText}>Recusar proposta</Text>
      </TouchableOpacity>
    </View>
  )
}

const TINTA = '#1A1A2E'
const PAPEL = '#F5F0E8'
const AMARELO = '#F2C94C'
const ZINCO = '#6B7280'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPEL },
  header: { backgroundColor: TINTA, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20, marginBottom: 24 },
  headerTitle: { color: PAPEL, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  headerSub: { color: AMARELO, fontSize: 14, fontWeight: '700' },
  tabela: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 8, padding: 20, borderWidth: 2, borderColor: '#E5E7EB', marginBottom: 16 },
  tabelaLabel: { fontSize: 11, fontWeight: '800', color: ZINCO, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 },
  tabelaLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  tabelaDescricao: { flex: 1, fontSize: 14, color: TINTA, paddingRight: 12 },
  tabelaValor: { fontSize: 14, fontWeight: '800', color: TINTA },
  tabelaTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, marginTop: 4 },
  tabelaTotalLabel: { fontSize: 13, fontWeight: '900', color: TINTA, textTransform: 'uppercase', letterSpacing: 1 },
  tabelaTotalValor: { fontSize: 20, fontWeight: '900', color: TINTA },
  escrowInfo: { flexDirection: 'row', gap: 12, marginHorizontal: 20, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 24, alignItems: 'flex-start' },
  escrowIcon: { fontSize: 22 },
  escrowText: { flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 20 },
  btnPrimary: { marginHorizontal: 20, backgroundColor: TINTA, borderRadius: 6, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: AMARELO, marginBottom: 12 },
  btnText: { color: PAPEL, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
  btnRecusar: { marginHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
  btnRecusarText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  // Ecrã de sucesso
  successContainer: { flex: 1, backgroundColor: '#0F2D1A', alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { fontSize: 64, marginBottom: 20 },
  successTitle: { fontSize: 28, fontWeight: '900', color: PAPEL, textAlign: 'center', marginBottom: 12 },
  successDesc: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  successCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 20, width: '100%', marginBottom: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  successCardLabel: { color: '#4ADE80', fontWeight: '900', fontSize: 15, marginBottom: 4 },
  successCardSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
})
