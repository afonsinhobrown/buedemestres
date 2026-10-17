import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/useAuthStore'
import { loadPlatformRates } from '../lib/rates'

type Plan = {
  id: number
  code: string
  name: string
  price: number
  max_services: number
  max_photos: number
  monthly_quotes: number | null
  weekend_priority: boolean
  priority_hours: any
  recurring_visibility: boolean
  rating_boost: number
  badge: string | null
  credit_price: number
  audience: string
  max_masters: number
}

export default function PlanosScreen() {
  const provider = useAuthStore((s) => s.providerProfile)
  const providerId = provider?.profile_id as string | undefined
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(null)
  const [wallet, setWallet] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [buying, setBuying] = useState<number | null>(null)
  const [credits, setCredits] = useState(0)
  const [creditPrice, setCreditPrice] = useState(300)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [isCompany, setIsCompany] = useState(false)
  const [rates, setRates] = useState<any>(null)

  const carregar = useCallback(async () => {
    if (!providerId) {
      setLoading(false)
      return
    }
    loadPlatformRates().then((value) => setRates(value))
    const [{ data: planRows }, { data: sub }, { data: walletRow }, { data: discountPct }, { data: creditRow }, { data: providerRow }, { data: companyRow }] = await Promise.all([
      supabase.from('plans').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('subscriptions').select('plan_id').eq('provider_id', providerId).eq('status', 'active').maybeSingle(),
      supabase.from('wallets').select('balance').eq('profile_id', providerId).maybeSingle(),
      supabase.rpc('provider_referral_discount_pct', { p_provider: providerId }),
      supabase.from('service_credits').select('balance').eq('provider_id', providerId).maybeSingle(),
      supabase.from('provider_profiles').select('trial_ends_at').eq('profile_id', providerId).maybeSingle(),
      supabase.from('companies').select('id').eq('owner_id', providerId).maybeSingle(),
    ])
    const companyOwner = Boolean(companyRow?.id)
    const plansList = ((planRows as Plan[]) || []).filter((plan) =>
      companyOwner ? plan.audience === 'company' : plan.audience !== 'company'
    )
    const activePlan = plansList.find((plan) => plan.id === sub?.plan_id)
    setIsCompany(companyOwner)
    setPlans(plansList)
    setCurrentPlanId(sub?.plan_id || null)
    setWallet(Number(walletRow?.balance || 0))
    setDiscount(Number(discountPct || 0))
    setCredits(Number(creditRow?.balance || 0))
    setCreditPrice(Number(activePlan?.credit_price || plansList.find((plan) => plan.code === (companyOwner ? 'company_basic' : 'basic'))?.credit_price || 300))
    setTrialEndsAt(providerRow?.trial_ends_at || null)
    setLoading(false)
  }, [providerId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const comprar = async (plan: Plan) => {
    if (!providerId) return
    const price = Number((Number(plan.price) * (1 - discount / 100)).toFixed(2))
    if (wallet < price) {
      Alert.alert(
        'Saldo insuficiente',
        `Precisas de MT ${price.toFixed(2)}. O teu saldo é MT ${wallet.toFixed(2)}.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Carregar saldo', onPress: () => router.push('/carregar') },
        ]
      )
      return
    }
    try {
      setBuying(plan.id)
      const { error } = await supabase.rpc('purchase_plan', { p_provider: providerId, p_plan: plan.id })
      if (error) throw error
      Alert.alert('Plano ativado', `O plano ${plan.name} está ativo por 30 dias.`)
      await carregar()
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível ativar o plano.')
    } finally {
      setBuying(null)
    }
  }

  const planPrice = (plan: Plan) => Number((Number(plan.price) * (1 - discount / 100)).toFixed(2))

  const comprarCreditos = async (qty: number) => {
    if (!providerId) return
    const total = Number((creditPrice * qty).toFixed(2))
    if (wallet < total) {
      Alert.alert(
        'Saldo insuficiente',
        `Precisas de MT ${total.toFixed(2)}. Carrega saldo primeiro.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Carregar', onPress: () => router.push('/carregar') },
        ]
      )
      return
    }
    try {
      const { error } = await supabase.rpc('purchase_credits', { p_provider: providerId, p_credits: qty })
      if (error) throw error
      Alert.alert('Créditos comprados', `${qty} crédito(s) adicionado(s).`)
      await carregar()
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível comprar créditos.')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Planos & Serviços</Text>
        <Text style={styles.sub}>Escolhe o plano mensal ou carrega saldo para serviços avulso.</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F2C94C" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.walletCard}>
            <View>
              <Text style={styles.walletLabel}>SALDO DISPONÍVEL</Text>
              <Text style={styles.walletValue}>MT {wallet.toLocaleString('pt-MZ')}</Text>
              {discount > 0 && (
                <Text style={styles.discountText}>🎁 Desconto de {discount}% por indicações</Text>
              )}
            </View>
            <TouchableOpacity style={styles.topupBtn} onPress={() => router.push('/carregar')}>
              <Text style={styles.topupBtnText}>Carregar</Text>
            </TouchableOpacity>
          </View>

          {rates && (
            <View style={styles.ratesCard}>
              <Text style={styles.ratesTitle}>TAXAS E FUNCIONAMENTO</Text>
              <Text style={styles.ratesLine}>• Comissão da plataforma: {Math.round(Number(rates.commissionRate) * 100)}% do valor do serviço</Text>
              <Text style={styles.ratesLine}>• Trial: {rates.trialDays} dias e {rates.trialServices} serviços com comissão de {Math.round(Number(rates.trialCommissionRate) * 100)}%</Text>
              <Text style={styles.ratesLine}>• 10.º serviço do mestre: comissão de {Math.round(Number(rates.trialCommissionRate) * 100)}%</Text>
              <Text style={styles.ratesLine}>• 11.º serviço do cliente recorrente: {rates.loyaltyDiscountPct}% de desconto</Text>
              <TouchableOpacity onPress={() => router.push('/termos')}>
                <Text style={styles.ratesLink}>Ler termos completos →</Text>
              </TouchableOpacity>
            </View>
          )}

          {trialEndsAt && new Date(trialEndsAt).getTime() > Date.now() && (
            <View style={styles.trialCard}>
              <Text style={styles.trialTitle}>🎁 TRIAL ATIVO</Text>
              <Text style={styles.trialText}>
                Até {new Date(trialEndsAt).toLocaleDateString('pt-MZ')} tens 5 serviços com comissão de 10%.
              </Text>
            </View>
          )}

          <View style={styles.creditsCard}>
            <View>
              <Text style={styles.creditsLabel}>CRÉDITOS DE SERVIÇO</Text>
              <Text style={styles.creditsValue}>{credits} crédito(s)</Text>
              <Text style={styles.creditsHint}>MT {creditPrice.toLocaleString('pt-MZ')} por crédito extra</Text>
            </View>
            <View style={styles.creditsButtons}>
              {[1, 5, 10].map((qty) => (
                <TouchableOpacity key={qty} style={styles.creditBtn} onPress={() => comprarCreditos(qty)}>
                  <Text style={styles.creditBtnText}>+{qty}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {plans.map((plan) => {
            const active = currentPlanId === plan.id
            const price = planPrice(plan)
            return (
              <View key={plan.id} style={[styles.planCard, active && styles.planCardActive]}>
                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planPrice}>
                      {plan.price === 0 ? 'Grátis' : `MT ${price.toLocaleString('pt-MZ')}/mês`}
                    </Text>
                    {discount > 0 && plan.price > 0 && (
                      <Text style={styles.oldPrice}>antes MT {Number(plan.price).toLocaleString('pt-MZ')}</Text>
                    )}
                  </View>
                  {plan.badge ? <Text style={styles.planBadge}>{plan.badge}</Text> : null}
                </View>

                <Text style={styles.benefit}>• {plan.max_services} serviços por mês</Text>
                <Text style={styles.benefit}>• {plan.max_photos} imagens no perfil</Text>
                <Text style={styles.benefit}>
                  • {plan.monthly_quotes == null ? 'Orçamentos ilimitados' : `${plan.monthly_quotes} orçamentos/mês`}
                </Text>
                <Text style={styles.benefit}>
                  • {plan.weekend_priority ? 'Prioridade aos fins de semana' : 'Sem prioridade de fim de semana'}
                </Text>
                <Text style={styles.benefit}>
                  • {plan.recurring_visibility ? 'Visível para clientes recorrentes' : 'Sem destaque para recorrentes'}
                </Text>
                <Text style={styles.benefit}>• Bónus de pontuação: {Number(plan.rating_boost).toFixed(2)}</Text>

                <TouchableOpacity
                  style={[styles.buyBtn, active && styles.buyBtnActive]}
                  onPress={() => comprar(plan)}
                  disabled={buying === plan.id || active}
                >
                  <Text style={[styles.buyBtnText, active && { color: '#0F2D1A' }]}>
                    {active ? '✓ Plano ativo' : buying === plan.id ? 'A ativar...' : 'Ativar plano'}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          })}

          <TouchableOpacity style={styles.affiliateLink} onPress={() => router.push('/afiliados')}>
            <Text style={styles.affiliateLinkText}>🤝 Traz 10 mestres e ganha desconto →</Text>
          </TouchableOpacity>
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
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  walletCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  walletLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  walletValue: { color: '#F5F0E8', fontSize: 26, fontWeight: '900', marginTop: 2 },
  discountText: { color: '#4ADE80', fontSize: 11, fontWeight: '700', marginTop: 2 },
  topupBtn: { backgroundColor: '#F2C94C', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  topupBtnText: { color: '#1A1A2E', fontWeight: '900', fontSize: 13 },
  trialCard: { backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)' },
  ratesCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  ratesTitle: { color: '#F2C94C', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  ratesLine: { color: '#CBD5E1', fontSize: 12, lineHeight: 18 },
  ratesLink: { color: '#4ADE80', fontSize: 12, fontWeight: '800', marginTop: 6 },
  trialTitle: { color: '#4ADE80', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  trialText: { color: '#BBF7D0', fontSize: 12, marginTop: 4 },
  creditsCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(242,201,76,0.3)' },
  creditsLabel: { color: '#F2C94C', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  creditsValue: { color: '#F5F0E8', fontSize: 24, fontWeight: '900', marginTop: 2 },
  creditsHint: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  creditsButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  creditBtn: { flex: 1, backgroundColor: '#F2C94C', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  creditBtnText: { color: '#1A1A2E', fontWeight: '900', fontSize: 14 },
  planCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  planCardActive: { borderColor: '#4ADE80', borderWidth: 2 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  planName: { color: '#F5F0E8', fontSize: 20, fontWeight: '900' },
  planPrice: { color: '#F2C94C', fontSize: 15, fontWeight: '900', marginTop: 2 },
  oldPrice: { color: '#94A3B8', fontSize: 11, textDecorationLine: 'line-through' },
  planBadge: { backgroundColor: 'rgba(242,201,76,0.18)', color: '#F2C94C', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '900', fontSize: 10 },
  benefit: { color: '#CBD5E1', fontSize: 12, lineHeight: 19 },
  buyBtn: { marginTop: 12, backgroundColor: '#4ADE80', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buyBtnActive: { backgroundColor: 'rgba(74,222,128,0.2)', borderWidth: 1, borderColor: '#4ADE80' },
  buyBtnText: { color: '#0F2D1A', fontWeight: '900', fontSize: 13, textTransform: 'uppercase' },
  affiliateLink: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  affiliateLinkText: { color: '#F2C94C', fontWeight: '800', fontSize: 12 },
})
