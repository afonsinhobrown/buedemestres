import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { Alert } from '../lib/alertCompat'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

type Method = 'emola' | 'mpesa' | 'bank_transfer'

export default function DadosPagamentoScreen() {
  const user = useAuthStore((s) => s.user)
  const provider = useAuthStore((s) => s.providerProfile)
  const profileId = provider?.profile_id || user?.id || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [method, setMethod] = useState<Method>('emola')
  const [accountName, setAccountName] = useState('')
  const [msisdn, setMsisdn] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')

  useEffect(() => {
    if (!profileId) return
    ;(async () => {
      const { data } = await supabase
        .from('provider_payout_accounts')
        .select('method, account_name, msisdn, bank_name, account_number')
        .eq('profile_id', profileId)
        .maybeSingle()
      if (data) {
        setMethod((data.method as Method) || 'emola')
        setAccountName(data.account_name || '')
        setMsisdn(data.msisdn || '')
        setBankName(data.bank_name || '')
        setAccountNumber(data.account_number || '')
      }
      setLoading(false)
    })()
  }, [profileId])

  const guardar = async () => {
    if (!profileId) {
      Alert.alert('Sessão', 'Entra na tua conta de mestre.')
      return
    }
    if (accountName.trim().length < 3) {
      Alert.alert('Dados em falta', 'Indica o nome do titular da conta.')
      return
    }
    if (method === 'bank_transfer') {
      if (bankName.trim().length < 2 || accountNumber.trim().length < 5) {
        Alert.alert('Dados em falta', 'Indica o banco e o número da conta.')
        return
      }
    } else if (msisdn.replace(/\D/g, '').length < 9) {
      Alert.alert('Dados em falta', 'Indica um número de telemóvel válido (9 dígitos).')
      return
    }

    try {
      setSaving(true)
      const { error } = await supabase.from('provider_payout_accounts').upsert(
        {
          profile_id: profileId,
          method,
          account_name: accountName.trim(),
          msisdn: method === 'bank_transfer' ? null : msisdn.trim(),
          bank_name: method === 'bank_transfer' ? bankName.trim() : null,
          account_number: method === 'bank_transfer' ? accountNumber.trim() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      )
      if (error) throw error
      Alert.alert('Dados guardados', 'Os teus dados de pagamento foram actualizados.', [
        { text: 'OK', onPress: () => router.replace('/carteira') },
      ])
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível guardar os dados.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F2C94C" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Dados de Pagamento</Text>
      <Text style={styles.sub}>
        É para aqui que o valor dos serviços concluídos será enviado. O valor é calculado pelo sistema.
      </Text>

      <Text style={styles.label}>MÉTODO</Text>
      <View style={styles.methods}>
        {([
          ['emola', '📲 e-Mola'],
          ['mpesa', '📱 M-Pesa'],
          ['bank_transfer', '🏦 Transferência bancária'],
        ] as [Method, string][]).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.methodBtn, method === id && styles.methodBtnActive]}
            onPress={() => setMethod(id)}
          >
            <Text style={[styles.methodText, method === id && styles.methodTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>NOME DO TITULAR</Text>
      <TextInput
        style={styles.input}
        value={accountName}
        onChangeText={setAccountName}
        placeholder="Nome completo"
        placeholderTextColor="#94A3B8"
      />

      {method === 'bank_transfer' ? (
        <>
          <Text style={styles.label}>BANCO</Text>
          <TextInput
            style={styles.input}
            value={bankName}
            onChangeText={setBankName}
            placeholder="Ex: BCI, Millennium bim, Standard Bank"
            placeholderTextColor="#94A3B8"
          />
          <Text style={styles.label}>NÚMERO DA CONTA / IBAN</Text>
          <TextInput
            style={styles.input}
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="Número da conta"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>NÚMERO {method === 'emola' ? 'E-MOLA' : 'M-PESA'}</Text>
          <TextInput
            style={styles.input}
            value={msisdn}
            onChangeText={setMsisdn}
            placeholder="Ex: 84 000 0000"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
          />
        </>
      )}

      <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={guardar} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'A guardar...' : 'Guardar dados de pagamento'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D1A' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F2D1A' },
  backBtn: { marginBottom: 12 },
  backBtnText: { color: '#F2C94C', fontWeight: '800', fontSize: 14 },
  title: { color: '#F5F0E8', fontSize: 26, fontWeight: '900', marginBottom: 6 },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 19, marginBottom: 20 },
  label: { color: '#F2C94C', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  methods: { gap: 8 },
  methodBtn: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.05)' },
  methodBtnActive: { backgroundColor: '#F2C94C', borderColor: '#F2C94C' },
  methodText: { color: '#F5F0E8', fontWeight: '800', fontSize: 13 },
  methodTextActive: { color: '#1A1A2E' },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  btn: { marginTop: 24, backgroundColor: '#4ADE80', borderRadius: 8, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#0F2D1A', fontWeight: '900', fontSize: 14, textTransform: 'uppercase' },
})
