import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Alert } from '../lib/alertCompat'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

type Company = {
  id: string
  legal_name: string
  trade_name: string
  nuit: string
  email: string | null
  phone: string | null
  address: string | null
  status: string
  verification: string
}

type CompanyMaster = {
  id: string
  provider_id: string
  is_active: boolean
  is_available: boolean
  profiles?: { full_name?: string; email?: string } | null
}

export default function EmpresaScreen() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id || ''
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<Company | null>(null)
  const [masters, setMasters] = useState<CompanyMaster[]>([])
  const [saving, setSaving] = useState(false)

  const [legalName, setLegalName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [nuit, setNuit] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [masterEmail, setMasterEmail] = useState('')

  const carregar = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    const { data: companyRow } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle()

    setCompany((companyRow as Company) || null)
    if (companyRow) {
      setLegalName(companyRow.legal_name)
      setTradeName(companyRow.trade_name)
      setNuit(companyRow.nuit)
      setEmail(companyRow.email || '')
      setPhone(companyRow.phone || '')
      setAddress(companyRow.address || '')

      const { data: masterRows } = await supabase
        .from('company_masters')
        .select('id, provider_id, is_active, is_available')
        .eq('company_id', companyRow.id)
      setMasters((masterRows as CompanyMaster[]) || [])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const criarEmpresa = async () => {
    if (!userId) return
    if (!legalName.trim() || !tradeName.trim() || !nuit.trim()) {
      Alert.alert('Dados em falta', 'Preenche nome legal, nome comercial e NUIT.')
      return
    }
    try {
      setSaving(true)
      const { data: created, error } = await supabase
        .from('companies')
        .insert({
          owner_id: userId,
          legal_name: legalName.trim(),
          trade_name: tradeName.trim(),
          nuit: nuit.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
        })
        .select('id')
        .single()
      if (error) throw error
      await supabase.from('company_masters').insert({
        company_id: created.id,
        provider_id: userId,
        role: 'owner',
        is_available: true,
      })
      Alert.alert('Empresa criada', 'A empresa ficou pendente de verificação.')
      await carregar()
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível criar a empresa.')
    } finally {
      setSaving(false)
    }
  }

  const adicionarDocumento = async () => {
    if (!company) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    try {
      setSaving(true)
      const response = await fetch(asset.uri)
      const blob = await response.blob()
      const path = `${company.id}/${Date.now()}-${asset.fileName || 'documento.jpg'}`
      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(path, blob, { contentType: asset.mimeType || 'image/jpeg', upsert: true })
      if (uploadError) throw uploadError
      const { data: publicUrl } = supabase.storage.from('company-documents').getPublicUrl(path)
      const { error } = await supabase.from('company_documents').insert({
        company_id: company.id,
        type: 'documento',
        file_url: publicUrl.publicUrl,
      })
      if (error) throw error
      Alert.alert('Documento enviado', 'O documento ficou pendente de verificação.')
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível enviar o documento.')
    } finally {
      setSaving(false)
    }
  }

  const adicionarMestre = async () => {
    if (!company || !masterEmail.trim()) return
    try {
      setSaving(true)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('email', masterEmail.trim().toLowerCase())
        .maybeSingle()
      if (!profile?.id) throw new Error('Mestre não encontrado com esse email.')

      const { data: provider } = await supabase
        .from('provider_profiles')
        .select('profile_id')
        .eq('profile_id', profile.id)
        .maybeSingle()
      if (!provider) throw new Error('Este utilizador ainda não tem perfil de mestre.')

      const { error } = await supabase.from('company_masters').insert({
        company_id: company.id,
        provider_id: profile.id,
        role: 'master',
        is_available: true,
      })
      if (error) throw error
      setMasterEmail('')
      await carregar()
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível adicionar o mestre.')
    } finally {
      setSaving(false)
    }
  }

  const alternarDisponibilidade = async (master: CompanyMaster) => {
    await supabase
      .from('company_masters')
      .update({ is_available: !master.is_available })
      .eq('id', master.id)
    await carregar()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F2C94C" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Empresa</Text>
        <Text style={styles.sub}>Registo, documentos e mestres da empresa.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!company ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Criar empresa</Text>
            {[
              ['Nome legal', legalName, setLegalName],
              ['Nome comercial', tradeName, setTradeName],
              ['NUIT', nuit, setNuit],
              ['Email', email, setEmail],
              ['Telefone', phone, setPhone],
              ['Endereço', address, setAddress],
            ].map(([label, value, setter]: any) => (
              <View key={label}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={setter}
                  placeholder={label}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            ))}
            <TouchableOpacity style={styles.btn} onPress={criarEmpresa} disabled={saving}>
              {saving ? <ActivityIndicator color="#0F2D1A" /> : <Text style={styles.btnText}>Criar empresa</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{company.trade_name}</Text>
              <Text style={styles.companyMeta}>NUIT: {company.nuit}</Text>
              <Text style={styles.companyMeta}>Estado: {company.status} · Verificação: {company.verification}</Text>
              <TouchableOpacity style={styles.btn} onPress={adicionarDocumento} disabled={saving}>
                <Text style={styles.btnText}>+ Enviar documento</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Mestres da empresa</Text>
              {masters.length === 0 ? (
                <Text style={styles.empty}>Ainda não associaste mestres.</Text>
              ) : (
                masters.map((master) => (
                  <View key={master.id} style={styles.masterRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.masterName}>{master.provider_id.slice(0, 8)}…</Text>
                      <Text style={styles.masterState}>
                        {master.is_available ? 'Disponível' : 'Indisponível'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.toggle, master.is_available && styles.toggleOn]}
                      onPress={() => alternarDisponibilidade(master)}
                    >
                      <Text style={styles.toggleText}>{master.is_available ? 'ON' : 'OFF'}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <Text style={[styles.label, { marginTop: 14 }]}>Adicionar mestre por email</Text>
              <TextInput
                style={styles.input}
                value={masterEmail}
                onChangeText={setMasterEmail}
                placeholder="mestre@email.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.btn} onPress={adicionarMestre} disabled={saving}>
                <Text style={styles.btnText}>Adicionar mestre</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F2D1A' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  cardTitle: { color: '#F5F0E8', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  label: { color: '#94A3B8', fontSize: 11, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', color: '#F5F0E8', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  btn: { marginTop: 16, backgroundColor: '#F2C94C', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#1A1A2E', fontWeight: '900', fontSize: 13 },
  companyMeta: { color: '#94A3B8', fontSize: 12, marginBottom: 4 },
  empty: { color: '#94A3B8', fontSize: 13 },
  masterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 10, marginBottom: 6 },
  masterName: { color: '#F5F0E8', fontWeight: '700', fontSize: 13 },
  masterState: { color: '#94A3B8', fontSize: 11 },
  toggle: { backgroundColor: '#334155', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  toggleOn: { backgroundColor: '#4ADE80' },
  toggleText: { color: '#0F2D1A', fontWeight: '900', fontSize: 11 },
})
