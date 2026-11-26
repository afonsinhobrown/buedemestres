import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native'
import { Alert } from '../lib/alertCompat'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { getAuthCallbackUrl } from '../lib/authRedirect'
import { BrandMark, Button } from '../components/v2'
import { colors, radius, shadows } from '../lib/theme'

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
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <BrandMark size={56} />
          <Text style={styles.logo}>Bué de Mestres Pro</Text>
          <Text style={styles.subtitle}>A plataforma dos mestres de Moçambique.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.formTitle}>
            {isLogin ? 'Entrar na conta de mestre' : 'Criar conta de mestre'}
          </Text>
          <Text style={styles.formHint}>
            {isLogin
              ? 'Entra para ficares online e receberes pedidos.'
              : 'Regista-te, conclui a verificação e começa a receber pedidos.'}
          </Text>

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="exemplo@email.com"
            placeholderTextColor="#7A8797"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>Palavra-passe</Text>
          <TextInput
            style={styles.input}
            placeholder="A tua palavra-passe"
            placeholderTextColor="#7A8797"
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
                placeholderTextColor="#7A8797"
                value={referralCode}
                onChangeText={setReferralCode}
                autoCapitalize="characters"
              />
            </>
          )}

          {!isLogin && (
            <View style={styles.checks}>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setAceitouTermos(!aceitouTermos)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, aceitouTermos && styles.checkboxOn]}>
                  {aceitouTermos && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkText}>
                  Li e aceito os Termos e a Política de Privacidade.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setAceitouEmails(!aceitouEmails)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, aceitouEmails && styles.checkboxOn]}>
                  {aceitouEmails && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkText}>
                  Aceito receber emails e comunicações da plataforma.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/termos')}>
                <Text style={styles.termsLink}>Ler os termos completos</Text>
              </TouchableOpacity>
            </View>
          )}

          {carregando ? (
            <ActivityIndicator size="large" color={colors.blue} style={styles.spinner} />
          ) : (
            <Button
              label={isLogin ? 'Entrar' : 'Criar conta'}
              onPress={handleAuth}
              style={{ marginTop: 20 }}
            />
          )}

          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => setIsLogin(!isLogin)}
            activeOpacity={0.7}
          >
            <Text style={styles.switchText}>
              {isLogin ? 'Ainda não tens conta? ' : 'Já tens conta? '}
              <Text style={styles.switchStrong}>
                {isLogin ? 'Criar uma' : 'Entrar'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.navy },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
    paddingTop: 42,
    paddingBottom: 34,
  },
  hero: { alignItems: 'center', marginBottom: 24 },
  logo: {
    marginTop: 14,
    fontSize: 27,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#C8D3E6',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  formTitle: { fontSize: 21, fontWeight: '900', color: colors.ink },
  formHint: { marginTop: 4, marginBottom: 14, fontSize: 12, lineHeight: 17, color: colors.muted },
  label: { marginTop: 10, marginBottom: 6, fontSize: 12, fontWeight: '800', color: colors.ink },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 15,
    color: colors.ink,
  },
  checks: { marginTop: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.yellow },
  checkmark: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  checkText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.muted },
  termsLink: {
    marginTop: 8,
    marginLeft: 32,
    fontSize: 12,
    fontWeight: '800',
    color: colors.blue,
    textDecorationLine: 'underline',
  },
  spinner: { marginVertical: 20 },
  switchMode: { alignItems: 'center', paddingTop: 16 },
  switchText: { fontSize: 12, color: colors.muted },
  switchStrong: { color: colors.blue, fontWeight: '900' },
})
