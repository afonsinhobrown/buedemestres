import { Platform } from 'react-native'

export const colors = {
  ink: '#0B1220',
  navy: '#12163A',
  blue: '#2444C8',
  blueDark: '#1B36A6',
  yellow: '#FFC61A',
  paper: '#F3F5F9',
  surface: '#FFFFFF',
  soft: '#E9EEFF',
  line: '#E2E7EF',
  muted: '#5B6472',
  green: '#0B8A4F',
  greenSoft: '#E6F8EF',
  red: '#C2410C',
  redSoft: '#FEE9E2',
  white: '#FFFFFF',
  overlay: 'rgba(11, 18, 32, 0.55)',
}

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 30,
}

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
    },
    android: { elevation: 3 },
    default: {},
  }) as object,
  floating: Platform.select({
    ios: {
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
    },
    android: { elevation: 10 },
    default: {},
  }) as object,
}

export function firstName(name?: string | null): string {
  const clean = String(name || '').trim()
  if (!clean) return ''
  return clean.split(/\s+/)[0]
}

export function initials(name?: string | null): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'BM'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function formatMoney(value: number | string | null | undefined): string {
  const number = Number(value || 0)
  return `MT ${number.toLocaleString('pt-MZ', { maximumFractionDigits: 2 })}`
}
