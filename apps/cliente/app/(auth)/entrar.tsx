import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function EntrarScreen() {
  const [email, setEmail] = useState('cliente@teste.com')
  const [senha, setSenha] = useState('password123')
  const [carregando, setCarregando] = useState(false)
  const [isLogin, setIsLogin] = useState(false) // Mudei para false para criar a conta à primeira

  const handleAuth = async () => {
    if (!email || !senha) {
      Alert.alert('Erro', 'Preencha email e senha')
      return
    }
    setCarregando(true)
    try {
      const authFunction = isLogin 
        ? supabase.auth.signInWithPassword 
        : supabase.auth.signUp;
        
      const { error } = await authFunction({ email, password: senha });
      
      if (error) throw error;
      
      router.replace('/')
    } catch (error: any) {
      const msg = error.message || 'Erro desconhecido'
      Alert.alert('Erro', msg)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF0F2" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Bué de Mestres</Text>
          <Text style={styles.subtitle}>A sua oficina digital</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{isLogin ? 'Entrar na conta' : 'Criar nova conta'}</Text>
          
          <View style={styles.form}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="exemplo@email.com"
              placeholderTextColor="#5B6472"
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
              placeholderTextColor="#5B6472"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </View>

          {carregando ? (
            <ActivityIndicator size="large" color="#2444C8" style={styles.spinner} />
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
        </View>
        
        <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/')}>
          <Text style={styles.backText}>Voltar ao início</Text>
        </TouchableOpacity>
      </View>
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
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 33,
    fontWeight: '900',
    color: '#12163A', // Tinta
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: '#5B6472', // Zinco
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#FFFFFF', // Papel
    borderRadius: 10,
    padding: 24,
    borderWidth: 2,
    borderColor: '#12163A',
    shadowColor: '#12163A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  formTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#12163A',
    marginBottom: 24,
  },
  form: {
    width: '100%',
    marginBottom: 32,
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#12163A',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#12163A',
    borderWidth: 2,
    borderColor: '#D5DAE0', // Zinco-200
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#2444C8', // Cobalto
    borderRadius: 4, // radius-placa
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#12163A',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  btnLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: '#2444C8',
    fontSize: 15,
    fontWeight: '700',
  },
  backLink: {
    marginTop: 32,
    alignItems: 'center',
  },
  backText: {
    color: '#5B6472',
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  spinner: {
    marginVertical: 16,
  },
})