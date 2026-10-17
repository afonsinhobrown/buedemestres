import { Platform } from 'react-native'
import { supabase } from './supabase'

let handlerConfigured = false

export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null

  try {
    const Notifications = await import('expo-notifications')
    const Device = await import('expo-device')
    const Constants = (await import('expo-constants')).default

    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      })
      handlerConfigured = true
    }

    if (!Device.isDevice) return null

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFC61A',
      })
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let status = existingStatus
    if (existingStatus !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status
    }
    if (status !== 'granted') return null

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      await supabase.from('push_subscriptions').upsert(
        {
          profile_id: user.id,
          platform: Platform.OS,
          expo_token: token,
        },
        { onConflict: 'profile_id,expo_token' }
      )
    }

    return token
  } catch (error) {
    console.warn('Erro ao registar push:', error)
    return null
  }
}
