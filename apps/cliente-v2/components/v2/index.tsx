import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { router, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, initials, radius, shadows, spacing } from '@/lib/theme'

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <View
      style={[
        styles.brandMark,
        { width: size, height: size, borderRadius: size * 0.3 },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ fontSize: size * 0.5 }}>🛠️</Text>
    </View>
  )
}

export function Avatar({
  uri,
  name,
  size = 42,
}: {
  uri?: string | null
  name?: string | null
  size?: number
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    )
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={{ color: colors.blue, fontWeight: '900', fontSize: size * 0.34 }}>
        {initials(name)}
      </Text>
    </View>
  )
}

export function IconButton({
  icon,
  onPress,
  label,
  badge,
  dark = false,
}: {
  icon: string
  onPress: () => void
  label: string
  badge?: number
  dark?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconButton, dark && styles.iconButtonDark]}
    >
      <Text style={[styles.iconGlyph, dark && { color: colors.white }]}>{icon}</Text>
      {badge && badge > 0 ? (
        <View style={styles.iconBadge}>
          <Text style={styles.iconBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  style,
  disabled = false,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'dark'
  icon?: string
  style?: StyleProp<ViewStyle>
  disabled?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'dark' && styles.buttonDark,
        disabled && { opacity: 0.55 },
        style,
      ]}
    >
      {icon ? <Text style={styles.buttonIcon}>{icon}</Text> : null}
      <Text
        style={[
          styles.buttonLabel,
          variant === 'primary' && { color: colors.navy },
          variant === 'secondary' && { color: colors.navy },
          variant === 'ghost' && { color: colors.blue },
          variant === 'dark' && { color: colors.white },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export function Chip({
  label,
  icon,
  active = false,
  onPress,
}: {
  label: string
  icon?: string
  active?: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      {icon ? <Text style={styles.chipIcon}>{icon}</Text> : null}
      <Text style={[styles.chipLabel, active && { color: colors.white }]}>{label}</Text>
    </TouchableOpacity>
  )
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} accessibilityRole="button">
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

export function Stat({
  label,
  value,
  tone = 'default',
  onPress,
}: {
  label: string
  value: string
  tone?: 'default' | 'green' | 'yellow' | 'red'
  onPress?: () => void
}) {
  const content = (
    <View style={styles.stat}>
      <Text
        style={[
          styles.statValue,
          tone === 'green' && { color: colors.green },
          tone === 'yellow' && { color: '#8A5A00' },
          tone === 'red' && { color: colors.red },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )

  if (!onPress) return content
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
      {content}
    </TouchableOpacity>
  )
}

export type NavItem = {
  label: string
  icon: string
  href: string
  badge?: number
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()

  return (
    <View style={[styles.bottomNav, { bottom: Math.max(insets.bottom, 10) }]}>
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <TouchableOpacity
            key={item.href}
            onPress={() => router.replace(item.href)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            style={[styles.navItem, active && styles.navItemActive]}
          >
            <View>
              <Text style={[styles.navIcon, active && { color: colors.blue }]}>
                {item.icon}
              </Text>
              {item.badge && item.badge > 0 ? (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>
                    {item.badge > 9 ? '9+' : item.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.navLabel, active && { color: colors.blue }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  brandMark: {
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback: {
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  iconGlyph: { fontSize: 18 },
  iconBadge: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  iconBadgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPrimary: { backgroundColor: colors.yellow },
  buttonSecondary: { backgroundColor: colors.soft },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  buttonDark: { backgroundColor: colors.navy },
  buttonIcon: { fontSize: 15 },
  buttonLabel: { fontSize: 14, fontWeight: '900' },
  chip: {
    minHeight: 38,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipIcon: { fontSize: 13 },
  chipLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  sectionAction: { fontSize: 12, fontWeight: '800', color: colors.blue },
  stat: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statValue: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 3 },
  bottomNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 60,
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.floating,
  },
  navItem: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navItemActive: { backgroundColor: colors.soft },
  navIcon: { fontSize: 18, color: colors.muted },
  navLabel: { fontSize: 10, fontWeight: '800', color: colors.muted },
  navBadge: {
    position: 'absolute',
    top: -3,
    right: -8,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: { color: colors.white, fontSize: 8, fontWeight: '900' },
})
