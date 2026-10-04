import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/lib/useAuthStore'

export default function EntrarScreen() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const { signOut } = useAuthStore()

  const handleAuth = async () => {
    if (!email || !senha) {
      Alert.alert('Erro', 'Preencha email e senha')
      return
    }
    setCarregando(true)
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, senha)
      } else {
        await createUserWithEmailAndPassword(auth, email, senha)
      }
      router.replace('/')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido'
      Alert.alert('Erro', msg)
    } finally {
      setCarregando(false)
    }
  }

  const handleSair = async () => {
    try {
      await signOut()
      router.replace('/(auth)/entrar')
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível sair')
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🔨 Bué de Mestres</Text>
      <Text style={styles.subtitle}>O mestre certo, onde precisas.</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoComplete={isLogin ? 'current-password' : 'new-password'}
        />
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#1A1A2E" style={styles.spinner} />
      ) : (
        <TouchableOpacity style={styles.btnPrimary} onPress={handleAuth}>
          <Text style={styles.btnText}>
            {isLogin ? 'ENTRAR' : 'CRIAR CONTA'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.btnLink} onPress={() => setIsLogin(!isLogin)}>
        <Text style={styles.linkText}>
          {isLogin ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
        </Text>
      </TouchableOpacity>

      {!isLogin && (
        <TouchableOpacity style={styles.btnSecondary} onPress={handleSair}>
          <Text style={styles.btnTextSecondary}>Sair</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1A1A2E',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#5C5C7A',
    marginBottom: 48,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#D1D1D1',
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#1A1A2E',
    borderRadius: 6,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#F2C94C',
  },
  btnText: {
    color: '#F5F0E8',
    fontWeight: '800',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  btnSecondary: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E74C3C',
  },
  btnTextSecondary: {
    color: '#E74C3C',
    fontWeight: '700',
    fontSize: 15,
  },
  btnLink: {
    marginTop: 16,
  },
  linkText: {
    color: '#1A1A2E',
    fontSize: 14,
    fontWeight: '600',
  },
  spinner: {
    marginVertical: 16,
  },
})