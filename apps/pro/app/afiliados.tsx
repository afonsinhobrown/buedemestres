import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Share } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'

export default function AfiliadosScreen() {
  const provider = useAuthStore((s) => s.providerProfile)
  const providerId = provider?.profile_id as string | undefined
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [count, setCount] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [threshold, setThreshold] = useState(10)
  const [referred, setReferred] = useState<Array<{ referred_id: string; full_name: string; created_at: string }>>([])

  useEffect(() => {
    if (!providerId) {
      setLoading(false)
      return
    }
    const carregar = async () => {
      const [{ data: profile }, { data: referralCount }, { data: discountPct }, { data: settings }, { data: list }] =
        await Promise.all([
          supabase.from('profiles').select('referral_code').eq('id', providerId).maybeSingle(),
          supabase.rpc('provider_referral_count', { p_provider: providerId }),
          supabase.rpc('provider_referral_discount_pct', { p_provider: providerId }),
          supabase.from('app_settings').select('key,value').eq('key', 'referral_threshold').maybeSingle(),
          supabase
            .from('referrals')
            .select('referred_id, created_at, profiles:referred_id(full_name)')
            .eq('referrer_id', providerId)
            .order('created_at', { ascending: false }),
        ])
      setCode(profile?.referral_code || '')
      setCount(Number(referralCount || 0))
      setDiscount(Number(discountPct || 0))
      setThreshold(Number((settings as any)?.value ?? 10))
      setReferred(
        (list || []).map((row: any) => ({
          referred_id: row.referred_id,
          full_name: row.profiles?.full_name || 'Mestre',
          created_at: row.created_at,
        }))
      )
      setLoading(false)
    }
    carregar()
  }, [providerId])

  const partilhar = async () => {
    if (!code) return
    await Share.share({
      message: `Junta-te ao Bué de Mestres como mestre com o meu código ${code}.`,
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Afiliados</Text>
        <Text style={styles.sub}>Traz mestres e ganha desconto nos planos.</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F2C94C" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>O TEU CÓDIGO</Text>
            <Text style={styles.codeValue}>{code || '—'}</Text>
            <TouchableOpacity style={styles.shareBtn} onPress={partilhar}>
              <Text style={styles.shareBtnText}>Partilhar convite</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{count}</Text>
              <Text style={styles.statLabel}>Mestres trazidos</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{discount}%</Text>
              <Text style={styles.statLabel}>Desconto atual</Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Ao trazeres {threshold} mestres ativos, ganhas {threshold > 0 ? '20' : '0'}% de desconto em todos os planos.
              {count >= threshold ? ' Benefício desbloqueado!' : ` Faltam ${threshold - count}.`}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>MESTRES QUE TRAZISTE</Text>
          {referred.length === 0 ? (
            <Text style={styles.empty}>Ainda não trouxeste nenhum mestre.</Text>
          ) : (
            referred.map((item) => (
              <View key={item.referred_id} style={styles.referralRow}>
                <Text style={styles.referralName}>{item.full_name}</Text>
                <Text style={styles.referralDate}>
                  {new Date(item.created_at).toLocaleDateString('pt-MZ')}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  codeCard: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(242,201,76,0.4)' },
  codeLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  codeValue: { color: '#F2C94C', fontSize: 34, fontWeight: '900', letterSpacing: 3, marginVertical: 8 },
  shareBtn: { backgroundColor: '#F2C94C', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  shareBtnText: { color: '#1A1A2E', fontWeight: '900', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  statNumber: { color: '#4ADE80', fontSize: 26, fontWeight: '900' },
  statLabel: { color: '#94A3B8', fontSize: 11, textTransform: 'uppercase' },
  infoBox: { backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' },
  infoText: { color: '#BBF7D0', fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
  empty: { color: '#94A3B8', fontSize: 13 },
  referralRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 },
  referralName: { color: '#F5F0E8', fontWeight: '700', fontSize: 13 },
  referralDate: { color: '#94A3B8', fontSize: 11 },
})
