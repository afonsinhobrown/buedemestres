import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native'
import { Alert } from '../lib/alertCompat'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { getAuthCallbackUrl } from '../lib/authRedirect'

export default function ProEntrarScreen() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [aceitouEmails, setAceitouEmails] = useState(false)

  const handleAuth = async () => {
    if (!email || !senha) {
      Alert.alert('Erro', 'Preenche email e senha')
      return
    }
    if (!isLogin && !aceitouTermos) {
      Alert.alert('Termos', 'Tens de ler e aceitar os Termos e a Política de Privacidade.')
      return
    }
    setCarregando(true)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
        router.replace('/')
      } else {
        const { data: terms } = await supabase
          .from('terms_versions')
          .select('id')
          .eq('audience', 'provider')
          .eq('is_current', true)
          .maybeSingle()
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: getAuthCallbackUrl(),
            data: {
              referral_code: referralCode.trim().toUpperCase() || null,
              terms_version_id: terms?.id || null,
              email_opt_in: aceitouEmails,
            },
          },
        })
        if (error) throw error
        if (!data.session) {
          Alert.alert(
            'Conta criada',
            'Confirma o teu email antes de entrar. Se já estiver confirmado, usa "Entrar".'
          )
          setIsLogin(true)
          return
        }
        router.replace('/')
      }
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F2D1A" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>🔨 Bué de Mestres Pro</Text>
          <Text style={styles.subtitle}>Plataforma do mestre</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{isLogin ? 'Entrar na conta' : 'Criar conta de mestre'}</Text>

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="exemplo@email.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Sua senha"
            placeholderTextColor="#94A3B8"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />

          {!isLogin && (
            <>
              <Text style={styles.label}>Código de convite (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: AB12CD34"
                placeholderTextColor="#94A3B8"
                value={referralCode}
                onChangeText={setReferralCode}
                autoCapitalize="characters"
              />
            </>
          )}

          {!isLogin && (
            <View style={{ marginTop: 6 }}>
              <TouchableOpacity style={styles.checkRow} onPress={() => setAceitouTermos(!aceitouTermos)} activeOpacity={0.8}>
                <View style={[styles.checkbox, aceitouTermos && styles.checkboxOn]}>
                  {aceitouTermos && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkText}>Li e aceito os Termos e a Política de Privacidade.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.checkRow} onPress={() => setAceitouEmails(!aceitouEmails)} activeOpacity={0.8}>
                <View style={[styles.checkbox, aceitouEmails && styles.checkboxOn]}>
                  {aceitouEmails && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkText}>Aceito receber emails e comunicações da plataforma.</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/termos')}>
                <Text style={styles.termsLink}>Ler os termos completos</Text>
              </TouchableOpacity>
            </View>
          )}

          {carregando ? (
            <ActivityIndicator size="large" color="#F2C94C" style={{ marginVertical: 16 }} />
          ) : (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleAuth}>
              <Text style={styles.btnText}>{isLogin ? 'ENTRAR' : 'CRIAR CONTA'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.btnLink} onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.linkText}>
              {isLogin ? 'Não tens conta? Criar uma' : 'Já tens conta? Entrar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F2D1A' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 30, fontWeight: '900', color: '#F5F0E8', letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#F2C94C', fontWeight: '600' },
  formCard: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  formTitle: { fontSize: 20, fontWeight: '900', color: '#F5F0E8', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', marginBottom: 6, marginTop: 10 },
  input: { height: 50, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, paddingHorizontal: 14, fontSize: 16, color: '#F5F0E8', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  btnPrimary: { backgroundColor: '#F2C94C', borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginTop: 24, marginBottom: 12 },
  btnText: { color: '#1A1A2E', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  btnLink: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: '#F2C94C', fontSize: 14, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#F2C94C', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: '#F2C94C' },
  checkmark: { color: '#1A1A2E', fontWeight: '900', fontSize: 13 },
  checkText: { flex: 1, color: '#E2E8F0', fontSize: 12, lineHeight: 17 },
  termsLink: { color: '#F2C94C', fontSize: 12, fontWeight: '800', textDecorationLine: 'underline', marginLeft: 32, marginTop: 6 },
})
