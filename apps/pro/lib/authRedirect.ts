import { Platform } from 'react-native'
import * as Linking from 'expo-linking'

export function getAuthCallbackUrl(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return Linking.createURL('/auth/callback')
  }
  return `${window.location.origin}/apps/pro/auth/callback`
}
