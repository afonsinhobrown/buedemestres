import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Linking } from 'react-native'
import { Alert } from '../lib/alertCompat'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || ''

export default function CarregarScreen() {
  const provider = useAuthStore((s) => s.providerProfile)
  const providerId = provider?.profile_id as string | undefined
  const [amount, setAmount] = useState('500')
  const [method, setMethod] = useState<'mpesa' | 'emola' | 'card'>('mpesa')
  const [submitting, setSubmitting] = useState(false)
  const [wallet, setWallet] = useState(0)

  useEffect(() => {
    if (!providerId) return
    supabase
      .from('wallets')
      .select('balance')
      .eq('profile_id', providerId)
      .maybeSingle()
      .then(({ data }) => setWallet(Number(data?.balance || 0)))
  }, [providerId])

  const carregar = async () => {
    const value = parseFloat(amount)
    if (!providerId) {
      Alert.alert('Sessão', 'Entra na tua conta de mestre.')
      return
    }
    if (!Number.isFinite(value) || value < 50) {
      Alert.alert('Valor inválido', 'O carregamento mínimo é MT 50.')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch(`${API_BASE}/api/payments/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: providerId, amount: value, method }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível iniciar o carregamento.')

      if (data.checkoutUrl) {
        try {
          await Linking.openURL(data.checkoutUrl)
        } catch {
          // o utilizador pode abrir manualmente
        }
      }

      let tries = 0
      const timer = setInterval(async () => {
        tries += 1
        try {
          const statusRes = await fetch(
            `${API_BASE}/api/payments/topup/status?reference=${encodeURIComponent(data.reference)}`
          )
          const statusData = await statusRes.json().catch(() => ({}))
          if (statusData?.paid) {
            clearInterval(timer)
            const { data: walletRow } = await supabase
              .from('wallets')
              .select('balance')
              .eq('profile_id', providerId)
              .maybeSingle()
            setWallet(Number(walletRow?.balance || 0))
            Alert.alert('Carregamento concluído', `O saldo foi creditado.`)
          } else if (statusData?.failed) {
            clearInterval(timer)
            Alert.alert('Carregamento não concluído', 'O pagamento foi cancelado ou recusado.')
          }
        } catch {
          // continua
        }
        if (tries > 120) clearInterval(timer)
      }, 3000)
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha no carregamento.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Carregar Saldo</Text>
        <Text style={styles.sub}>Usa o saldo para comprar planos ou serviços avulso.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>SALDO ATUAL</Text>
        <Text style={styles.balance}>MT {wallet.toLocaleString('pt-MZ')}</Text>

        <Text style={[styles.label, { marginTop: 18 }]}>VALOR A CARREGAR (MÍN. MT 50)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          placeholder="500"
          placeholderTextColor="#94A3B8"
        />

        <Text style={[styles.label, { marginTop: 18 }]}>MÉTODO</Text>
        <View style={styles.methods}>
          {(['mpesa', 'emola', 'card'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.methodBtn, method === item && styles.methodBtnActive]}
              onPress={() => setMethod(item)}
            >
              <Text style={[styles.methodText, method === item && styles.methodTextActive]}>
                {item === 'mpesa' ? 'M-Pesa' : item === 'emola' ? 'e-Mola' : 'Cartão'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.btn, submitting && { opacity: 0.6 }]} onPress={carregar} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#0F2D1A" /> : <Text style={styles.btnText}>Carregar Saldo</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A' },
  header: { paddingTop: 48, paddingBottom: 18, paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.2)' },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#F2C94C', fontSize: 14, fontWeight: '800' },
  title: { color: '#F5F0E8', fontSize: 26, fontWeight: '900' },
  sub: { color: '#F2C94C', fontSize: 12, fontWeight: '600', marginTop: 2 },
  card: { margin: 16, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  label: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  balance: { color: '#F5F0E8', fontSize: 28, fontWeight: '900', marginTop: 2 },
  input: { marginTop: 6, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', color: '#F5F0E8', fontSize: 22, fontWeight: '900', paddingHorizontal: 14, paddingVertical: 12 },
  methods: { flexDirection: 'row', gap: 8, marginTop: 8 },
  methodBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  methodBtnActive: { backgroundColor: '#F2C94C', borderColor: '#F2C94C' },
  methodText: { color: '#F5F0E8', fontSize: 12, fontWeight: '800' },
  methodTextActive: { color: '#1A1A2E' },
  btn: { marginTop: 22, backgroundColor: '#4ADE80', borderRadius: 8, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#0F2D1A', fontWeight: '900', fontSize: 14, textTransform: 'uppercase' },
})
