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
import { Alert } from '@/lib/alertCompat'
import { useAuthStore } from '@/lib/useAuthStore'
import { Avatar, BrandMark, Button } from '@/components/v2'
import { colors, radius, shadows } from '@/lib/theme'

const MENU = [
  { icon: '📋', label: 'Meus pedidos', href: '/pedidos' },
  { icon: '🔔', label: 'Notificações', href: '/notificacoes' },
  { icon: '🧰', label: 'Categorias de serviço', href: '/categorias' },
  { icon: '🎧', label: 'Suporte', href: '/suporte' },
  { icon: '💬', label: 'Assistente virtual', href: '/ajuda-bot' },
  { icon: '📄', label: 'Termos e condições', href: '/termos' },
  { icon: '🔒', label: 'Privacidade', href: '/privacidade' },
]

export default function PerfilScreen() {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)

  const handleSignOut = () => {
    Alert.alert('Terminar sessão', 'Queres sair da tua conta?', [
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
          <Text style={styles.pageTitle}>Conta</Text>
        </View>

        <View style={styles.profileCard}>
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={68} />
          <Text style={styles.name}>{profile?.full_name || 'Cliente'}</Text>
          <Text style={styles.meta}>{user?.email || 'Conta Bué de Mestres'}</Text>
          {profile?.phone ? <Text style={styles.meta}>{profile.phone}</Text> : null}
          <View style={styles.memberPill}>
            <Text style={styles.memberText}>Cliente verificado</Text>
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
        <Text style={styles.version}>Bué de Mestres · versão 2.0</Text>
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
  name: { marginTop: 12, fontSize: 20, fontWeight: '900', color: colors.ink },
  meta: { marginTop: 3, fontSize: 12, color: colors.muted },
  memberPill: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
  },
  memberText: { color: colors.green, fontSize: 10, fontWeight: '900' },
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
