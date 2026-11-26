import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Alert } from '../lib/alertCompat'
import { useAuthStore } from '../lib/useAuthStore'
import { Avatar, BrandMark, Button } from '../components/v2'
import { colors, radius, shadows } from '../lib/theme'

const MENU = [
  { icon: '◫', label: 'Carteira e ganhos', href: '/carteira' },
  { icon: '＋', label: 'Carregar saldo', href: '/carregar' },
  { icon: '💳', label: 'Planos e destaques', href: '/planos' },
  { icon: '🤝', label: 'Afiliados', href: '/afiliados' },
  { icon: '🏢', label: 'Empresa', href: '/empresa' },
  { icon: '🪪', label: 'Dados de pagamento', href: '/dados-pagamento' },
  { icon: '🛡️', label: 'Verificação de identidade', href: '/verificacao' },
  { icon: '🎧', label: 'Suporte', href: '/suporte' },
  { icon: '📄', label: 'Termos e condições', href: '/termos' },
  { icon: '🔒', label: 'Privacidade', href: '/privacidade' },
]

export default function PerfilProScreen() {
  const user = useAuthStore((s) => s.user)
  const providerProfile = useAuthStore((s) => s.providerProfile)
  const signOut = useAuthStore((s) => s.signOut)

  const name =
    providerProfile?.business_name ||
    (providerProfile?.profiles as any)?.full_name ||
    'Mestre'

  const handleSignOut = () => {
    Alert.alert('Terminar sessão', 'Queres sair da tua conta de mestre?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
    ])
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <BrandMark size={36} />
          <Text style={styles.pageTitle}>Conta do mestre</Text>
        </View>

        <View style={styles.profileCard}>
          <Avatar
            uri={(providerProfile?.profiles as any)?.avatar_url}
            name={name}
            size={68}
          />
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>{user?.email || 'Conta Bué de Mestres Pro'}</Text>
          <View style={styles.tags}>
            {providerProfile?.categories?.name ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{providerProfile.categories.name}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.tag,
                providerProfile?.verification === 'approved'
                  ? styles.tagGreen
                  : styles.tagYellow,
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  providerProfile?.verification === 'approved'
                    ? { color: colors.green }
                    : { color: '#6B5300' },
                ]}
              >
                {providerProfile?.verification === 'approved'
                  ? 'Verificado'
                  : 'Verificação pendente'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.menu}>
          {MENU.map((item) => (
            <TouchableOpacity
              key={item.href}
              style={styles.menuRow}
              onPress={() => router.push(item.href as any)}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.menuIcon}>
                <Text style={{ fontSize: 17 }}>{item.icon}</Text>
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          label="Terminar sessão"
          variant="ghost"
          onPress={handleSignOut}
          style={{ marginTop: 18 }}
        />
        <Text style={styles.version}>Bué de Mestres Pro · versão 2.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18, paddingBottom: 28 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  pageTitle: { fontSize: 20, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 },
  profileCard: {
    alignItems: 'center',
    padding: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  name: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
  },
  meta: { marginTop: 3, fontSize: 12, color: colors.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.soft,
  },
  tagGreen: { backgroundColor: colors.greenSoft },
  tagYellow: { backgroundColor: '#FFF4CC' },
  tagText: { fontSize: 10, fontWeight: '900', color: colors.blue },
  menu: {
    marginTop: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.ink },
  menuArrow: { fontSize: 15, color: colors.muted, fontWeight: '800' },
  version: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
  },
})
